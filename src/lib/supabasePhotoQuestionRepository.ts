/**
 * Supabase 実装の写真クイズリポジトリ。
 *
 * - `findByFilter` / `countByFilter` / `findByIds`: 公開ビュー `public_photo_questions` から取得
 * - `findBySubmitterId` / `submit`: ベーステーブル `user_photo_questions` を直接操作
 * - `submit`: 画像 Blob を Storage に PUT → 公開 URL を取得 → メタを DB に INSERT
 *
 * 読み書きで参照先が分かれているのは §24 の RLS 設計による。
 * ベーステーブルは「自分の投稿しか SELECT できない」ので出題には使えず、
 * ビューは読み取り専用なので投稿には使えない。
 *
 * 未接続環境 (環境変数なし) では Supabase 呼び出しを行わず空配列を返す。
 * 通常はこのリポジトリ単体で使わず、`compositePhotoQuestionRepository` 経由で
 * モックと合成して使う。
 */
import type {
  NoodleThickness,
  PhotoDifficulty,
  PhotoQuestion,
  PhotoQuestionFilter,
  PhotoType,
  RamenType,
} from '@/types/photoQuestion';
import { PHOTO_QUIZ_QUESTION_TEXT } from '@/types/photoQuestion';
import { isValidPrefecture } from '@/data/prefectures';
import {
  getSupabaseClient,
  PUBLIC_PHOTO_QUESTIONS_VIEW,
  SUPABASE_STORAGE_BUCKET,
  USER_PHOTO_QUESTIONS_TABLE,
} from './supabaseClient';
import {
  matchesFilter,
  type PhotoQuestionRepository,
  type PhotoQuestionSubmission,
} from './photoQuestionRepository';

/**
 * Supabase 側のレート制限トリガーが発火した際にフロントへ伝える専用エラー。
 *
 * DB トリガー `enforce_submit_rate_limit` は `rate_limit_exceeded:<残り秒数>` 形式で
 * `RAISE EXCEPTION` を返す。`submit` ではこのメッセージを正規表現で検出して
 * `RateLimitError` に変換し、UI 側で「あと N 分 M 秒」表示に使える構造化情報を提供する。
 *
 * docs/SUPABASE_SETUP.md §7 参照。
 */
export class RateLimitError extends Error {
  /** 再投稿可能になるまでの残り秒数 (最低 1)。 */
  public readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`rate_limit_exceeded:${retryAfterSeconds}`);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = Math.max(1, Math.floor(retryAfterSeconds));
    // ES5 ターゲットでも instanceof が機能するように prototype を復元
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Supabase の PostgrestError メッセージから `rate_limit_exceeded:<秒数>` を検出する。
 * 該当しない場合は `null`。
 */
function parseRateLimitMessage(message: string | undefined | null): number | null {
  if (!message) return null;
  const match = message.match(/rate_limit_exceeded:(\d+)/);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds;
}

/** Supabase 行 -> ドメイン型 へのマッピング用の row 型。 */
interface UserPhotoQuestionRow {
  id: string;
  /**
   * 公開ビュー `public_photo_questions` 経由では `show_submitter = false` の行が
   * `null` にマスクされて返る (docs/SUPABASE_SETUP.md §24)。
   * ベーステーブル経由 (自分の投稿) では常に文字列。
   */
  submitter_id: string | null;
  /** 出題時に作成者名を表示してよいか (docs/SUPABASE_SETUP.md §22)。 */
  show_submitter: boolean | null;
  image_path: string;
  ramen_type: string;
  prefecture: string;
  photo_type: string;
  difficulty: string;
  noodle_thickness: string | null;
  question: string;
  options: unknown;
  answer_idx: number;
  explanation: string | null;
  shop_info: unknown;
  created_at: string;
}

/**
 * SELECT で取得する列。`*` ではなく明示列挙にしておくことで、
 * 「テーブルに列を足したら勝手にクライアントへ流れる」事故を防ぐ。
 * 新しい列を UI で使いたくなったらここに追記する。
 */
const SELECT_COLUMNS =
  'id, submitter_id, show_submitter, image_path, ramen_type, prefecture, photo_type, ' +
  'difficulty, noodle_thickness, question, options, answer_idx, explanation, shop_info, created_at';

function isStringArrayOfFour(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((v) => typeof v === 'string')
  );
}

/**
 * `shop_info` JSONB をドメイン型に変換する。
 * `name` は必須なので無ければ `null` を返し、呼び出し側で行ごと除外する。
 */
function parseShopInfo(value: unknown): PhotoQuestion['shopInfo'] | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.length === 0) return null;
  const result: PhotoQuestion['shopInfo'] = { name: obj.name };
  if (typeof obj.area === 'string') result.area = obj.area;
  if (typeof obj.genre === 'string') result.genre = obj.genre;
  if (typeof obj.description === 'string') result.description = obj.description;
  return result;
}

/** 既知の RamenType / PhotoType / Difficulty / NoodleThickness かどうかの軽量チェック。 */
const RAMEN_TYPES = new Set<RamenType>([
  'shoyu',
  'shio',
  'miso',
  'tonkotsu',
  'iekei',
  'jiro',
  'tsukemen',
  'tantanmen',
  'other',
]);
const PHOTO_TYPES = new Set<PhotoType>([
  'storefront',
  'interior',
  'ticketMachine',
  'ramen',
  'other',
]);
const DIFFICULTIES = new Set<PhotoDifficulty>(['high', 'mid', 'low']);
const NOODLE_THICKNESSES = new Set<NoodleThickness>([
  'thin',
  'mediumThin',
  'mediumThick',
  'thick',
  'wavy',
  'straight',
]);

/**
 * Storage 内パスから公開 URL を組み立てる。
 * Public バケット前提 (RLS 認証は不要)。
 */
function buildPublicImageUrl(imagePath: string): string {
  const client = getSupabaseClient();
  if (!client) return imagePath;
  const { data } = client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(imagePath);
  return data.publicUrl;
}

/**
 * DB 行を PhotoQuestion に変換する。バリデーションを通らない行は `null` を返し
 * 呼び出し側でフィルタする (壊れた行が混入してもアプリが落ちないように)。
 */
function rowToPhotoQuestion(row: UserPhotoQuestionRow): PhotoQuestion | null {
  if (!isStringArrayOfFour(row.options)) return null;
  if (!RAMEN_TYPES.has(row.ramen_type as RamenType)) return null;
  if (!PHOTO_TYPES.has(row.photo_type as PhotoType)) return null;
  if (!DIFFICULTIES.has(row.difficulty as PhotoDifficulty)) return null;
  if (!isValidPrefecture(row.prefecture)) return null;
  if (typeof row.answer_idx !== 'number' || row.answer_idx < 0 || row.answer_idx > 3) return null;

  const shopInfo = parseShopInfo(row.shop_info);
  if (!shopInfo) return null;

  const noodleThickness =
    row.noodle_thickness && NOODLE_THICKNESSES.has(row.noodle_thickness as NoodleThickness)
      ? (row.noodle_thickness as NoodleThickness)
      : undefined;

  // 作成者名は「公開する」を選んだ投稿だけドメイン型に載せる。
  // ここで落としておけば、表示側が誤って非公開の投稿者名を出す余地がなくなる。
  const submitterName =
    row.show_submitter === true && typeof row.submitter_id === 'string' && row.submitter_id.length > 0
      ? row.submitter_id
      : undefined;

  return {
    id: row.id,
    imageUrl: buildPublicImageUrl(row.image_path),
    ramenType: row.ramen_type as RamenType,
    prefecture: row.prefecture,
    photoType: row.photo_type as PhotoType,
    difficulty: row.difficulty as PhotoDifficulty,
    noodleThickness,
    question: row.question,
    options: row.options,
    answerIdx: row.answer_idx,
    explanation: row.explanation ?? undefined,
    shopInfo,
    submitterName,
  };
}

/**
 * 一意な Storage パスを生成する。
 * 形式: `submissions/<yyyy>/<mm>/<32桁の16進乱数>.webp`
 *
 * **ファイル名に投稿者名を含めない**。バケットは公開設定で、画像 URL は
 * 出題時に誰にでも見えるため、ファイル名にユーザー名を入れると
 * §22 / §24 で隠した作成者名が URL から読めてしまう。
 * 年月のディレクトリは残しているが、これは `created_at` として元々公開されている情報。
 *
 * 乱数は 128 bit (`crypto.getRandomValues`)。衝突を実質ゼロにしつつ、
 * `upsert: false` で万一の衝突時はアップロードが失敗する側に倒している。
 */
function generateImagePath(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `submissions/${year}/${month}/${rand}.webp`;
}

export const supabasePhotoQuestionRepository: PhotoQuestionRepository = {
  async findByFilter(filter: PhotoQuestionFilter): Promise<PhotoQuestion[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // 公開ビュー経由。非表示化 (§20) の除外と作成者名のマスク (§22) は
    // ビュー定義側で済んでいるため、ここでフィルタを書く必要はない。
    const { data, error } = await client
      .from(PUBLIC_PHOTO_QUESTIONS_VIEW)
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false });
    if (error) {
      // 取得失敗時は空配列扱いにしてアプリ落ちを防ぐ (モック側でフォールバック)
      console.warn('[supabasePhotoQuestionRepository] findByFilter failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as unknown as UserPhotoQuestionRow[];
    const questions: PhotoQuestion[] = [];
    for (const row of rows) {
      const q = rowToPhotoQuestion(row);
      if (q && matchesFilter(q, filter)) questions.push(q);
    }
    return questions;
  },

  async countByFilter(filter: PhotoQuestionFilter): Promise<number> {
    const questions = await this.findByFilter(filter);
    return questions.length;
  },

  async submit(
    data: PhotoQuestionSubmission,
    image: Blob,
  ): Promise<PhotoQuestion> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase が未接続のため投稿できません。');
    }

    // 1) Storage に画像 PUT
    const imagePath = generateImagePath();
    const uploadResult = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(imagePath, image, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadResult.error) {
      // §24 で Storage の INSERT も authenticated 限定にした。
      // セッション切れのときは RLS 違反として弾かれるので、DB INSERT 側と同じ案内に揃える。
      if (/row-level security|Unauthorized|violates/i.test(uploadResult.error.message)) {
        throw new Error(
          '画像の権限を確認できませんでした。ログインし直してからもう一度お試しください。',
        );
      }
      throw new Error(`画像アップロードに失敗しました: ${uploadResult.error.message}`);
    }

    // 2) DB に INSERT
    // 問題文は全問共通の固定文字列 (PHOTO_QUIZ_QUESTION_TEXT) を必ずセットする。
    // ユーザー入力ではなく、DB 側 CHECK 制約もこの値以外を拒否する設計。
    const insertPayload = {
      submitter_id: data.submitterId,
      // 明示的に true を渡されたときだけ公開。undefined や不正値は非公開に倒す。
      show_submitter: data.showSubmitter === true,
      image_path: imagePath,
      ramen_type: data.ramenType,
      prefecture: data.prefecture,
      photo_type: data.photoType,
      difficulty: data.difficulty,
      noodle_thickness: data.noodleThickness ?? null,
      question: PHOTO_QUIZ_QUESTION_TEXT,
      options: data.options,
      answer_idx: data.answerIdx,
      explanation: data.explanation ?? null,
      shop_info: data.shopInfo,
    };

    const { data: inserted, error } = await client
      .from(USER_PHOTO_QUESTIONS_TABLE)
      .insert(insertPayload)
      .select(SELECT_COLUMNS)
      .single();

    if (error || !inserted) {
      // Storage に画像だけ残るのを避けるためロールバック試行 (失敗しても投稿エラー扱い)
      await client.storage.from(SUPABASE_STORAGE_BUCKET).remove([imagePath]).catch(() => undefined);

      // レート制限トリガーからの専用エラーは構造化された RateLimitError に変換する。
      // PostgrestError は `message` 以外に `details` / `hint` にも文言が入り得るため広めに探す。
      const composite = [error?.message, error?.details, error?.hint]
        .filter((s): s is string => typeof s === 'string')
        .join(' | ');
      const retryAfter = parseRateLimitMessage(composite);
      if (retryAfter !== null) {
        throw new RateLimitError(retryAfter);
      }

      // §24 の INSERT ポリシーは submitter_id がログイン中のユーザー名と一致することを求める。
      // セッション切れや、プロフィール未作成の状態で投稿するとここに落ちる。
      // 生の RLS メッセージは利用者に意味が伝わらないので、行動を書いた文言に差し替える。
      if (error?.code === '42501' || /row-level security/i.test(composite)) {
        throw new Error(
          '投稿の権限を確認できませんでした。ログインし直してからもう一度お試しください。',
        );
      }

      throw new Error(`投稿の登録に失敗しました: ${error?.message ?? '不明なエラー'}`);
    }

    const row = inserted as unknown as UserPhotoQuestionRow;
    const result = rowToPhotoQuestion(row);
    if (!result) {
      throw new Error('投稿は登録されましたが、レスポンスのパースに失敗しました。');
    }
    return result;
  },

  async findBySubmitterId(submitterId: string): Promise<PhotoQuestion[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // ここだけはベーステーブルを直接読む。公開ビューは非公開投稿の submitter_id を
    // null にマスクするため、`.eq('submitter_id', ...)` で自分の投稿を引けない。
    // §24 の RLS により、ベーステーブルから返るのは元々「自分の投稿」だけなので、
    // 下の eq は二重の絞り込み (サーバ側の保証 + 明示的な意図表明) になっている。
    //
    // 自分の投稿一覧でも自動非表示化された行は隠す。
    // (投稿者に「なぜ消えたか」の表示は将来課題。当面は運営通知で対応。)
    const { data, error } = await client
      .from(USER_PHOTO_QUESTIONS_TABLE)
      .select(SELECT_COLUMNS)
      .eq('submitter_id', submitterId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    if (error) {
      // 取得失敗時は空配列扱いにしてアプリ落ちを防ぐ
      console.warn(
        '[supabasePhotoQuestionRepository] findBySubmitterId failed:',
        error.message,
      );
      return [];
    }
    const rows = (data ?? []) as unknown as UserPhotoQuestionRow[];
    const questions: PhotoQuestion[] = [];
    for (const row of rows) {
      const q = rowToPhotoQuestion(row);
      if (q) questions.push(q);
    }
    return questions;
  },

  async findByIds(ids: string[]): Promise<PhotoQuestion[]> {
    if (ids.length === 0) return [];
    const client = getSupabaseClient();
    if (!client) return [];
    // お気に入り復元・レビュー参照時も公開ビュー経由 (非表示行はビューに含まれない)。
    const { data, error } = await client
      .from(PUBLIC_PHOTO_QUESTIONS_VIEW)
      .select(SELECT_COLUMNS)
      .in('id', ids);
    if (error) {
      console.warn('[supabasePhotoQuestionRepository] findByIds failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as unknown as UserPhotoQuestionRow[];
    const questions: PhotoQuestion[] = [];
    for (const row of rows) {
      const q = rowToPhotoQuestion(row);
      if (q) questions.push(q);
    }
    return questions;
  },
};
