import type { PhotoQuestion, PhotoQuestionFilter } from '@/types/photoQuestion';

/**
 * 投稿フォーム入力の生データ。
 * - `id` は DB 側採番
 * - `imageUrl` は Storage アップロード結果から決まる
 * - `question` は全問共通の固定文字列 (`PHOTO_QUIZ_QUESTION_TEXT`) をリポジトリ側でセットする
 * - `shopInfo` は必須 (name 必須)
 */
export type PhotoQuestionSubmission = Omit<
  PhotoQuestion,
  'id' | 'imageUrl' | 'thumbnailUrl' | 'question'
> & {
  /** 投稿者識別子 (Phase 2: localStorage の username, Phase 3+: Supabase auth.uid)。 */
  submitterId: string;
};

/**
 * 写真当てクイズの問題データソース抽象 IF。
 * Phase 1: ローカル JSON のモック実装。
 * Phase 2 以降: Supabase / 自前 API に差し替え予定。
 */
export interface PhotoQuestionRepository {
  /** フィルタにマッチする問題を全件取得する (順序は実装依存)。 */
  findByFilter(filter: PhotoQuestionFilter): Promise<PhotoQuestion[]>;
  /** フィルタにマッチする問題数を返す。開始画面のリアルタイム件数表示用。 */
  countByFilter(filter: PhotoQuestionFilter): Promise<number>;
  /**
   * ユーザー投稿問題を永続化する。
   * 画像 Blob を Storage に PUT し、メタを DB に INSERT する。
   * モック実装では未対応とし `submit` フィールドを持たないため、
   * 投稿可能か否かは呼び出し側で `'submit' in repo` で判定する。
   */
  submit?(data: PhotoQuestionSubmission, image: Blob): Promise<PhotoQuestion>;
  /**
   * 特定の `submitterId` が投稿した問題の一覧を新しい順で返す (任意)。
   * マイページの「投稿履歴」表示に利用する。
   * 未実装のリポジトリは undefined を返す想定。
   */
  findBySubmitterId?(submitterId: string): Promise<PhotoQuestion[]>;
  /**
   * 指定 ID の問題群を取得する。学習モードの復習セッション用。
   * ID の順序は保持しない (呼び出し側で shuffle する想定)。
   * 見つからなかった ID は結果に含まれず、単に欠落する (エラーにはならない)。
   */
  findByIds(ids: string[]): Promise<PhotoQuestion[]>;
}

/** リポジトリが `submit` をサポートするかの型ガード。 */
export function canSubmit(
  repo: PhotoQuestionRepository,
): repo is Required<Pick<PhotoQuestionRepository, 'submit'>> & PhotoQuestionRepository {
  return typeof repo.submit === 'function';
}

/**
 * 1 問が `filter` にマッチするか判定する。
 * - 各軸の配列が空 / undefined なら絞り込みなし扱い
 * - 同軸内は OR、異なる軸間は AND
 * - `noodleThickness` が未設定の問題は、その軸の絞り込みが指定されたとき除外する
 */
export function matchesFilter(
  question: PhotoQuestion,
  filter: PhotoQuestionFilter,
): boolean {
  if (filter.ramenTypes && filter.ramenTypes.length > 0) {
    if (!filter.ramenTypes.includes(question.ramenType)) return false;
  }
  if (filter.prefectures && filter.prefectures.length > 0) {
    if (!filter.prefectures.includes(question.prefecture)) return false;
  }
  if (filter.photoTypes && filter.photoTypes.length > 0) {
    if (!filter.photoTypes.includes(question.photoType)) return false;
  }
  if (filter.difficulties && filter.difficulties.length > 0) {
    if (!filter.difficulties.includes(question.difficulty)) return false;
  }
  if (filter.noodleThicknesses && filter.noodleThicknesses.length > 0) {
    if (!question.noodleThickness) return false;
    if (!filter.noodleThicknesses.includes(question.noodleThickness)) return false;
  }
  return true;
}
