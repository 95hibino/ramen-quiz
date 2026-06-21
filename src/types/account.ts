/**
 * アカウント / スコア関連のドメイン型定義。
 *
 * 設計方針:
 * - 個人情報 (メールアドレス・実名・電話番号など) は一切扱わない。
 * - パスワードは平文では保持しない (`PasswordCredential` を参照)。
 * - 都道府県は `data/prefectures.ts` のリストから選択する。
 */
import type { Prefecture } from '@/data/prefectures';
import type { QuizCategory } from '@/types/quiz';

/** 保存されるユーザー本体 (公開できる情報のみを含む)。 */
export interface User {
  /** 内部 ID (UUID 形式の文字列)。 */
  id: string;
  /** 表示名 (3-20 字, ユニーク)。 */
  username: string;
  /** 都道府県。 */
  prefecture: Prefecture;
  /** 好きなラーメン店 (1-50 字, 自由入力)。 */
  favoriteShop: string;
  /** ISO8601 のアカウント作成日時。 */
  createdAt: string;
}

/** パスワード認証用クレデンシャル (ハッシュのみ保存)。 */
export interface PasswordCredential {
  /** 対応する `User.id`。 */
  userId: string;
  /** SHA-256 ハッシュ (16進文字列)。 */
  passwordHash: string;
  /** ハッシュに使用したソルト (ユーザー名から派生)。 */
  salt: string;
}

/** サインアップ時に受け取る入力。 */
export interface SignupInput {
  username: string;
  password: string;
  prefecture: Prefecture;
  favoriteShop: string;
}

/** ログイン時に受け取る入力。 */
export interface LoginInput {
  username: string;
  password: string;
}

/** 1 プレイ分のスコアレコード。 */
export interface ScoreRecord {
  id: string;
  userId: string;
  /**
   * 知識クイズのカテゴリ (初級/中級/上級)。写真当てクイズなど
   * カテゴリ概念のないクイズタイプでは省略する。
   */
  category?: QuizCategory;
  /** 'knowledge' | 'photo' のクイズタイプ大分類。 */
  quizType: string;
  /** 当該プレイで獲得した合計点。 */
  score: number;
  /** 正解数。 */
  correctCount: number;
  /** 問題数。 */
  totalCount: number;
  /** ISO8601 の記録日時。 */
  playedAt: string;
}

/** ランキング表示用にユーザーごとに集計した結果。 */
export interface RankingEntry {
  user: User;
  /** 合計スコア。 */
  totalScore: number;
  /** プレイ回数。 */
  playCount: number;
}

/** リポジトリ層から返される標準エラー種別。 */
export type AuthErrorCode =
  | 'username_taken'
  | 'invalid_credentials'
  | 'validation_error'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
