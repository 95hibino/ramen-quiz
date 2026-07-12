/**
 * Supabase Auth 実装の AuthRepository。
 *
 * ユーザー名 + パスワード UX を維持しつつ、内部的には Supabase Auth の Email+Password
 * 認証を fake email (`<hash>@example.com`) 経由で使う。
 *
 * ID は Supabase Auth が発行する auth.uid() (UUID)。public_profiles.id と一致させ、
 * `quiz_scores.user_id = auth.uid()` を RLS で強制することで詐称を防ぐ。
 *
 * Supabase Auth 側で:
 * - Email confirmation を無効化 (fake email には送信できないため)
 * - Anonymous / Magic link は不要
 *
 * このモジュールは Supabase 接続時のみ使う。未接続時は localAuthRepository を利用。
 *
 * 【自己修復設計】
 * - signup は 3 段階 (auth.users 作成 → セッション確立 → public_profiles upsert) で
 *   途中で失敗すると片方だけ登録される「孤児状態」が起こり得る。
 * - これを避けるため、signup 開始前に pending-profile を localStorage に保存し、
 *   login 時に profile が DB にいなければ pending-profile から自動 upsert して復旧する。
 * - 完全に成功した signup では pending-profile をクリアするので通常は無害。
 */
import { AuthError as SupabaseAuthError, type Session } from '@supabase/supabase-js';
import type {
  AuthErrorCode,
  LoginInput,
  SignupInput,
  User,
} from '@/types/account';
import { AuthError } from '@/types/account';
import { isValidPrefecture, type Prefecture } from '@/data/prefectures';
import {
  validateFavoriteShop,
  validatePassword,
  validatePrefecture,
  validateUsername,
} from '@/lib/validation';
import type { AuthRepository } from '@/lib/authRepository';
import { getSupabaseClient, PUBLIC_PROFILES_TABLE } from './supabaseClient';
import { usernameToFakeEmail } from './fakeEmail';

/** Supabase の public_profiles 行を User に変換する。 */
interface PublicProfileRow {
  id: string;
  username: string;
  prefecture: string;
  favorite_shop: string;
  created_at: string;
}

function rowToUser(row: PublicProfileRow): User | null {
  if (!isValidPrefecture(row.prefecture)) return null;
  return {
    id: row.id,
    username: row.username,
    prefecture: row.prefecture as Prefecture,
    favoriteShop: row.favorite_shop,
    createdAt: row.created_at,
  };
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new AuthError('unknown', 'Supabase に接続できません。');
  }
  return client;
}

/**
 * Supabase Auth のエラーコード / メッセージから、アプリ内 AuthErrorCode に変換する。
 * Supabase JS SDK は詳細メッセージが英語のため、ユーザー向けは日本語に整える。
 */
function toAuthError(err: unknown, fallbackMessage: string): AuthError {
  if (err instanceof AuthError) return err;
  const message = err instanceof Error ? err.message : String(err);
  let code: AuthErrorCode = 'unknown';
  if (err instanceof SupabaseAuthError) {
    // Supabase の代表的なコード名は "invalid_credentials" / "user_already_exists" など。
    const c = err.code ?? '';
    if (c.includes('user_already_exists') || c.includes('email_exists')) {
      code = 'username_taken';
    } else if (
      c.includes('invalid_credentials') ||
      c.includes('invalid_grant') ||
      c.includes('email_not_confirmed')
    ) {
      code = 'invalid_credentials';
    }
  }
  const uiMessage =
    code === 'username_taken'
      ? 'このユーザー名は既に使われています。'
      : code === 'invalid_credentials'
        ? 'ユーザー名またはパスワードが違います。'
        : `${fallbackMessage} (${message})`;
  return new AuthError(code, uiMessage);
}

/** Supabase 側で自分の public_profiles 行を 1 件だけ取得する。 */
async function fetchProfileById(userId: string): Promise<User | null> {
  const client = requireClient();
  const { data, error } = await client
    .from(PUBLIC_PROFILES_TABLE)
    .select('id, username, prefecture, favorite_shop, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[supabaseAuthRepository] fetchProfileById failed:', error.message);
    return null;
  }
  if (!data) return null;
  return rowToUser(data as PublicProfileRow);
}

/**
 * Supabase Auth のセッションから現在ユーザーを復元する。
 * mount 時などに呼び出す。
 */
export async function restoreCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const session: Session | null = data.session;
  if (!session?.user) return null;
  return fetchProfileById(session.user.id);
}

// ==========================================================================
// pending-profile: signup 中断時の自己修復用ストレージ
// ==========================================================================
// signup 開始時に「これから登録しようとしている profile 情報」を localStorage に保存し、
// 何らかの理由で public_profiles への upsert が失敗して孤児状態になった場合に、
// 次回 login 時に自動で復旧できるようにする。

const PENDING_PROFILE_STORAGE_KEY = 'ramen-quiz:pending-profile';

interface PendingProfile {
  username: string;
  prefecture: string;
  favoriteShop: string;
  savedAt: string;
}

function savePendingProfile(profile: Omit<PendingProfile, 'savedAt'>): void {
  try {
    localStorage.setItem(
      PENDING_PROFILE_STORAGE_KEY,
      JSON.stringify({ ...profile, savedAt: new Date().toISOString() } satisfies PendingProfile),
    );
  } catch {
    /* localStorage 容量超過等は無視 (修復機能は best-effort) */
  }
}

function loadPendingProfile(): PendingProfile | null {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as PendingProfile).username !== 'string' ||
      typeof (parsed as PendingProfile).prefecture !== 'string' ||
      typeof (parsed as PendingProfile).favoriteShop !== 'string'
    ) {
      return null;
    }
    return parsed as PendingProfile;
  } catch {
    return null;
  }
}

function clearPendingProfile(): void {
  try {
    localStorage.removeItem(PENDING_PROFILE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 与えられた User 情報を public_profiles に upsert する。エラーがあれば投げる。
 * signup 時と login 時の自己修復時の両方から使う。
 */
async function upsertProfileRow(user: User): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from(PUBLIC_PROFILES_TABLE)
    .upsert(
      {
        id: user.id,
        username: user.username,
        prefecture: user.prefecture,
        favorite_shop: user.favoriteShop,
      },
      { onConflict: 'id' },
    );
  if (error) {
    throw new AuthError(
      'unknown',
      `プロフィール保存に失敗しました: ${error.message}`,
    );
  }
}

export const supabaseAuthRepository: AuthRepository = {
  async signup(input: SignupInput): Promise<User> {
    const usernameErr = validateUsername(input.username);
    if (usernameErr) throw new AuthError('validation_error', usernameErr);
    const passwordErr = validatePassword(input.password);
    if (passwordErr) throw new AuthError('validation_error', passwordErr);
    const prefectureErr = validatePrefecture(input.prefecture);
    if (prefectureErr) throw new AuthError('validation_error', prefectureErr);
    const favoriteShopErr = validateFavoriteShop(input.favoriteShop);
    if (favoriteShopErr) throw new AuthError('validation_error', favoriteShopErr);

    const username = input.username.trim();
    const favoriteShop = input.favoriteShop.trim();
    const client = requireClient();

    // ユーザー名の重複チェック (fake email が同じなら DB 側 unique 制約で弾かれるが、
    // その前に事前判定してエラーメッセージを分かりやすくする)。
    const taken = await this.isUsernameTaken(username);
    if (taken) {
      throw new AuthError('username_taken', 'このユーザー名は既に使われています。');
    }

    const email = await usernameToFakeEmail(username);

    // 【自己修復ステップ 0】 signup 開始前に profile 情報を localStorage に保存する。
    // ここで失敗しても signup は続行、次回 login 時にリカバリ可能。
    savePendingProfile({ username, prefecture: input.prefecture, favoriteShop });

    // Supabase Auth 側にユーザー作成。
    // Email confirmation は Supabase ダッシュボードで OFF にしておくこと (SUPABASE_SETUP.md §11)。
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password: input.password,
    });
    if (signUpError || !signUpData.user) {
      throw toAuthError(signUpError, 'アカウント作成に失敗しました。');
    }

    // 【重要】 signUp 直後は Supabase JS の内部 PostgrestClient のトークンキャッシュに
    // 新セッションが伝播していないことがあり、続く upsert が anon 扱いで RLS で弾かれる
    // race condition が発生する。これを回避するため、必ず signInWithPassword を明示的に
    // 呼んでセッションを確定させる。Confirm email が ON の場合はここで失敗する
    // (未確認メールへのサインインは Supabase 側で拒否される)。
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (signInError || !signInData.session || !signInData.user) {
      throw new AuthError(
        'unknown',
        `アカウント作成後の自動サインインに失敗しました${signInError ? ` (${signInError.message})` : ''}。Supabase Dashboard で「Confirm email」を OFF にしてください (docs/SUPABASE_SETUP.md §11 参照)。`,
      );
    }

    // 更に念のため getSession を呼び、内部トークンキャッシュを明示的に最新化する。
    // これで続く upsert は必ず新セッションの JWT を Authorization ヘッダに載せる。
    await client.auth.getSession();

    // public_profiles に upsert。id は auth.uid() と一致する。
    // signUpData.user.id と signInData.user.id は同じだが、セッション確定後の signInData 側を採用。
    const newProfile: User = {
      id: signInData.user.id,
      username,
      prefecture: input.prefecture,
      favoriteShop,
      createdAt: new Date().toISOString(),
    };
    // 【変更】 silent fail をやめる。upsert に失敗したら明示エラーを投げる。
    // pending-profile はクリアせず残しておく → 次回 login 時に自己修復される。
    await upsertProfileRow(newProfile);

    // 成功したので pending-profile はクリア。
    clearPendingProfile();

    return newProfile;
  },

  async login(input: LoginInput): Promise<User> {
    const username = input.username.trim();
    if (username.length === 0 || input.password.length === 0) {
      throw new AuthError('invalid_credentials', 'ユーザー名とパスワードを入力してください。');
    }
    const client = requireClient();
    const email = await usernameToFakeEmail(username);

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.user) {
      throw toAuthError(error, 'ログインに失敗しました。');
    }

    const profile = await fetchProfileById(data.user.id);
    if (profile) return profile;

    // 【自己修復】 Auth 認証は成功したが public_profiles に行が無い (孤児状態)。
    // signup の途中で失敗した可能性。pending-profile が同じユーザー名なら自動で upsert する。
    const pending = loadPendingProfile();
    if (pending && pending.username.trim().toLowerCase() === username.toLowerCase()) {
      if (!isValidPrefecture(pending.prefecture)) {
        throw new AuthError(
          'unknown',
          'プロフィール情報の自動復旧に失敗しました。都道府県の値が不正です。再サインアップしてください。',
        );
      }
      const restored: User = {
        id: data.user.id,
        username,
        prefecture: pending.prefecture as Prefecture,
        favoriteShop: pending.favoriteShop,
        createdAt: new Date().toISOString(),
      };
      try {
        await upsertProfileRow(restored);
        clearPendingProfile();
        console.info('[supabaseAuthRepository] pending-profile から self-heal に成功しました');
        return restored;
      } catch (healErr) {
        console.warn('[supabaseAuthRepository] self-heal に失敗:', healErr);
        throw new AuthError(
          'unknown',
          'プロフィール情報の自動復旧に失敗しました。再度サインアップしてください。',
        );
      }
    }

    // 復旧材料なし。明示的にサインアップを促す。
    throw new AuthError(
      'unknown',
      'プロフィール情報が見つかりません。再度サインアップしてください。',
    );
  },

  async isUsernameTaken(username: string): Promise<boolean> {
    const normalized = username.trim();
    if (normalized.length === 0) return false;
    const client = requireClient();
    // username カラムに対する大小無視の一致で探す (SQL 側インデックス lower(username) を活かす)。
    const { data, error } = await client
      .from(PUBLIC_PROFILES_TABLE)
      .select('id')
      .ilike('username', normalized)
      .limit(1);
    if (error) {
      console.warn('[supabaseAuthRepository] isUsernameTaken failed:', error.message);
      return false;
    }
    return (data ?? []).length > 0;
  },

  async findUserById(userId: string): Promise<User | null> {
    return fetchProfileById(userId);
  },

  async listUsers(): Promise<User[]> {
    const client = requireClient();
    const { data, error } = await client
      .from(PUBLIC_PROFILES_TABLE)
      .select('id, username, prefecture, favorite_shop, created_at');
    if (error) {
      console.warn('[supabaseAuthRepository] listUsers failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as PublicProfileRow[];
    const users: User[] = [];
    for (const row of rows) {
      const u = rowToUser(row);
      if (u) users.push(u);
    }
    return users;
  },
};

/**
 * Supabase Auth からログアウトする。
 * AuthRepository の interface にはないが、ストア側 (`authStore.logout`) で呼び出す。
 */
export async function supabaseLogout(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}
