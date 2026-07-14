/**
 * Supabase 実装の写真クイズリポジトリ。
 *
 * - `findByFilter` / `countByFilter`: `user_photo_questions` テーブルから取得
 * - `submit`: 画像 Blob を Storage に PUT → 公開 URL を取得 → メタを DB に INSERT
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
  submitter_id: string;
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
  };
}

/**
 * 一意な Storage パスを生成する。
 * 形式: `submissions/<yyyy>/<mm>/<submitterId>-<timestamp>-<rand>.webp`
 * (人間が見て投稿元と時系列を追える程度の情報)。
 */
function generateImagePath(submitterId: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeId = submitterId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 32);
  const rand = Math.random().toString(36).slice(2, 10);
  return `submissions/${year}/${month}/${safeId}-${now.getTime()}-${rand}.webp`;
}

export const supabasePhotoQuestionRepository: PhotoQuestionRepository = {
  async findByFilter(filter: PhotoQuestionFilter): Promise<PhotoQuestion[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // is_hidden = false のみ取得。通報トリガー (§19) で自動非表示化された行を除外する。
    const { data, error } = await client
      .from(USER_PHOTO_QUESTIONS_TABLE)
      .select('*')
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    if (error) {
      // 取得失敗時は空配列扱いにしてアプリ落ちを防ぐ (モック側でフォールバック)
      console.warn('[supabasePhotoQuestionRepository] findByFilter failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as UserPhotoQuestionRow[];
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
    const imagePath = generateImagePath(data.submitterId);
    const uploadResult = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(imagePath, image, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadResult.error) {
      throw new Error(`画像アップロードに失敗しました: ${uploadResult.error.message}`);
    }

    // 2) DB に INSERT
    // 問題文は全問共通の固定文字列 (PHOTO_QUIZ_QUESTION_TEXT) を必ずセットする。
    // ユーザー入力ではなく、DB 側 CHECK 制約もこの値以外を拒否する設計。
    const insertPayload = {
      submitter_id: data.submitterId,
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
      .select('*')
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

      throw new Error(`投稿の登録に失敗しました: ${error?.message ?? '不明なエラー'}`);
    }

    const row = inserted as UserPhotoQuestionRow;
    const result = rowToPhotoQuestion(row);
    if (!result) {
      throw new Error('投稿は登録されましたが、レスポンスのパースに失敗しました。');
    }
    return result;
  },

  async findBySubmitterId(submitterId: string): Promise<PhotoQuestion[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    // 自分の投稿一覧でも自動非表示化された行は隠す。
    // (投稿者に「なぜ消えたか」の表示は将来課題。当面は運営通知で対応。)
    const { data, error } = await client
      .from(USER_PHOTO_QUESTIONS_TABLE)
      .select('*')
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
    const rows = (data ?? []) as UserPhotoQuestionRow[];
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
    // お気に入り復元・レビュー参照時も自動非表示化された行は除外。
    const { data, error } = await client
      .from(USER_PHOTO_QUESTIONS_TABLE)
      .select('*')
      .in('id', ids)
      .eq('is_hidden', false);
    if (error) {
      console.warn('[supabasePhotoQuestionRepository] findByIds failed:', error.message);
      return [];
    }
    const rows = (data ?? []) as UserPhotoQuestionRow[];
    const questions: PhotoQuestion[] = [];
    for (const row of rows) {
      const q = rowToPhotoQuestion(row);
      if (q) questions.push(q);
    }
    return questions;
  },
};
