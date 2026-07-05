/**
 * Supabase Auth 実装の AuthRepository。
 *
 * ユーザー名 + パスワード UX を維持しつつ、内部的には Supabase Auth の Email+Password
 * 認証を fake email (`<hash>@ramen-quiz.internal`) 経由で使う。
 *
 * ID は Supabase Auth が発行する auth.uid() (UUID)。public_profiles.id と一致させ、
 * `quiz_scores.user_id = auth.uid()` を RLS で強制することで詐称を防ぐ。
 *
 * Supabase Auth 側で:
 * - Email confirmation を無効化 (fake email には送信できないため)
 * - Anonymous / Magic link は不要
 *
 * このモジュールは Supabase 接続時のみ使う。未接続時は localAuthRepository を利用。
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

    // Supabase Auth 側にユーザー作成 + 自動でサインインまで済ませる。
    // Email confirmation は Supabase ダッシュボードで OFF にしておくこと (SUPABASE_SETUP.md §11)。
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
      email,
      password: input.password,
    });
    if (signUpError || !signUpData.user) {
      throw toAuthError(signUpError, 'アカウント作成に失敗しました。');
    }

    // public_profiles に upsert。id は auth.uid() と一致する。
    const newProfile: User = {
      id: signUpData.user.id,
      username,
      prefecture: input.prefecture,
      favoriteShop,
      createdAt: new Date().toISOString(),
    };
    const { error: profileError } = await client
      .from(PUBLIC_PROFILES_TABLE)
      .upsert(
        {
          id: newProfile.id,
          username: newProfile.username,
          prefecture: newProfile.prefecture,
          favorite_shop: newProfile.favoriteShop,
        },
        { onConflict: 'id' },
      );
    if (profileError) {
      // Auth ユーザーは作成済みなので rollback は難しい (Service Role Key が必要)。
      // ここは警告に留め、次回ログイン時に再 upsert 可能な設計にしておく。
      console.warn(
        '[supabaseAuthRepository] public_profiles upsert failed after signup:',
        profileError.message,
      );
    }

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
    if (!profile) {
      // Auth 認証成功だがプロフィール未登録 (旧サインアップの中断など)。
      // localStorage に情報が無ければ再度サインアップ情報を求めるべきだが、
      // ここでは最小限のユーザーを返して UI 側に判定させる。
      throw new AuthError(
        'unknown',
        'プロフィール情報が見つかりません。再度サインアップしてください。',
      );
    }
    return profile;
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
