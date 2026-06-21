/**
 * 写真当てクイズドメインの型定義 (design §3.2)。
 *
 * 5 軸 (ラーメン種類 / 都道府県 / 写真種類 / 難易度 / 麺の太さ) で
 * フィルタリングして出題する。
 *
 * 問題文は全問共通の固定文字列 (`PHOTO_QUIZ_QUESTION_TEXT`) で、店名を当てるクイズ形式。
 * 画像素材は社長提供の実画像 (`public/photo_quiz/`) を順次投入していく運用。
 */
import type { Prefecture } from '@/data/prefectures';

/** ラーメンの種類 (系統)。 */
export type RamenType =
  | 'shoyu'
  | 'shio'
  | 'miso'
  | 'tonkotsu'
  | 'iekei'
  | 'jiro'
  | 'tsukemen'
  | 'tantanmen'
  | 'other';

/** 写真に写っている被写体の種類。 */
export type PhotoType = 'storefront' | 'interior' | 'ticketMachine' | 'ramen' | 'other';

/** 麺の太さ・形状。 */
export type NoodleThickness = 'thin' | 'mediumThin' | 'mediumThick' | 'thick' | 'wavy' | 'straight';

/** 難易度 (写真クイズ用、3段階)。 */
export type PhotoDifficulty = 'high' | 'mid' | 'low';

/**
 * 写真当てクイズの問題文は全問共通の固定文字列とする。
 * - 投稿フォームから編集不可
 * - DB 側 CHECK 制約でもこの値以外を拒否
 * - 既存問題もこの値で統一されている
 */
export const PHOTO_QUIZ_QUESTION_TEXT = 'この画像はどこの店のものですか？';

/** 写真当てクイズ 1 問分。 */
export interface PhotoQuestion {
  id: string;
  /** 画像 URL (相対パス可)。 */
  imageUrl: string;
  /** サムネイル URL (任意)。 */
  thumbnailUrl?: string;
  ramenType: RamenType;
  /** 47 都道府県の漢字表記。`data/prefectures.ts` の値と一致させる。 */
  prefecture: Prefecture;
  photoType: PhotoType;
  difficulty: PhotoDifficulty;
  /** 任意。麺の太さで絞り込むときに使う。 */
  noodleThickness?: NoodleThickness;
  /** 問題文。`PHOTO_QUIZ_QUESTION_TEXT` で統一されている。 */
  question: string;
  /** 4 択。順序は表示順そのまま使う。 */
  options: string[];
  /** 0..options.length-1 */
  answerIdx: number;
  /** 解説文。任意。 */
  explanation?: string;
  /** 店舗情報。`name` は必須、その他は任意。 */
  shopInfo: {
    name: string;
    area?: string;
    genre?: string;
    description?: string;
  };
}

/**
 * 写真当てクイズの絞り込みフィルタ。
 * 各軸とも空配列 / undefined は「全件対象 (絞り込みなし)」を意味する。
 * 同軸内は OR、異なる軸間は AND で評価する。
 */
export interface PhotoQuestionFilter {
  ramenTypes?: RamenType[];
  prefectures?: Prefecture[];
  photoTypes?: PhotoType[];
  difficulties?: PhotoDifficulty[];
  noodleThicknesses?: NoodleThickness[];
}

/** 5軸の表示メタ (UI ラベル定義用)。 */
export interface PhotoFilterAxisOption<T extends string> {
  value: T;
  label: string;
}

export const RAMEN_TYPE_OPTIONS: PhotoFilterAxisOption<RamenType>[] = [
  { value: 'shoyu', label: '醤油' },
  { value: 'shio', label: '塩' },
  { value: 'miso', label: '味噌' },
  { value: 'tonkotsu', label: '豚骨' },
  { value: 'iekei', label: '家系' },
  { value: 'jiro', label: '二郎系' },
  { value: 'tsukemen', label: 'つけ麺' },
  { value: 'tantanmen', label: '担々麺' },
  { value: 'other', label: 'その他' },
];

export const PHOTO_TYPE_OPTIONS: PhotoFilterAxisOption<PhotoType>[] = [
  { value: 'storefront', label: '店の外観' },
  { value: 'interior', label: '店内' },
  { value: 'ticketMachine', label: '券売機' },
  { value: 'ramen', label: 'ラーメン' },
  { value: 'other', label: 'その他' },
];

export const DIFFICULTY_OPTIONS: PhotoFilterAxisOption<PhotoDifficulty>[] = [
  { value: 'high', label: '高' },
  { value: 'mid', label: '中' },
  { value: 'low', label: '低' },
];

export const NOODLE_THICKNESS_OPTIONS: PhotoFilterAxisOption<NoodleThickness>[] = [
  { value: 'thin', label: '細麺' },
  { value: 'mediumThin', label: '中細' },
  { value: 'mediumThick', label: '中太' },
  { value: 'thick', label: '太麺' },
  { value: 'wavy', label: '縮れ' },
  { value: 'straight', label: 'ストレート' },
];
