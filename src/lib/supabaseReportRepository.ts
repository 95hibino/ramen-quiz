/**
 * 写真クイズ通報用 Supabase リポジトリ。
 *
 * `content_reports` テーブルへ INSERT する薄いラッパー + 通報者ブロック状態の取得。
 *
 * 通報のフロー (§20 の設計):
 * - ログイン必須。`reporter_id = auth.uid()` を必ずセットして INSERT
 * - 同じ人が同じ問題を複数回通報 → DB の UNIQUE 制約で `23505 unique_violation`
 *   → フロントで「既に通報済み」表示
 * - 24 時間で 5 件超えた通報者は `reporter_blocks` に登録され、次回以降 RLS で拒否
 *   → `42501` (permission denied / RLS violation) を返すのでフロントで案内文表示
 * - 通報が集まっても自動非表示化はしない (§19 廃止)。社長が SQL でレビュー・対応する
 */
import { getSupabaseClient } from './supabaseClient';
import type { ReportReason } from './validation';

/** 通報用テーブル名。 */
export const CONTENT_REPORTS_TABLE = 'content_reports';

/** 通報者ブロックテーブル名 (§20)。 */
export const REPORTER_BLOCKS_TABLE = 'reporter_blocks';

/** 通報送信ペイロード (DB スキーマと整合)。 */
export interface ReportSubmission {
  /** 対象問題の UUID (`user_photo_questions.id`)。 */
  questionId: string;
  /** 通報者の Supabase Auth UID (auth.uid())。ログイン必須。 */
  reporterId: string;
  /** 必須。`inappropriate` / `copyright` / `privacy` / `misinfo` / `other`。 */
  reason: ReportReason;
  /** 任意。最大 500 字。 */
  body?: string;
}

/** 通報者ブロック情報。 */
export interface ReporterBlockRecord {
  reporterId: string;
  blockedAt: string;
  reason: string | null;
  autoReportCount: number | null;
}

/** 通報送信の失敗理由 (フロント側での分岐用)。 */
export type SubmitReportErrorKind =
  | 'not_configured'    // Supabase 未接続
  | 'already_reported'  // UNIQUE 違反 = 既に通報済み
  | 'blocked'           // RLS 拒否 = 通報者がブロック中
  | 'unknown';

export class SubmitReportError extends Error {
  public readonly kind: SubmitReportErrorKind;

  constructor(kind: SubmitReportErrorKind, message: string) {
    super(message);
    this.name = 'SubmitReportError';
    this.kind = kind;
    Object.setPrototypeOf(this, SubmitReportError.prototype);
  }
}

/** Supabase が利用可能かを返す。UI 側は通報ボタンの表示制御に使う。 */
export function isReportRepositoryReady(): boolean {
  return getSupabaseClient() !== null;
}

/**
 * 通報を送信する。
 *
 * @throws {SubmitReportError} kind で失敗理由を分岐可能
 */
export async function submitReport(payload: ReportSubmission): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new SubmitReportError('not_configured', 'Supabase が未接続のため通報できません。');
  }

  const trimmedBody = payload.body?.trim();
  const insertPayload = {
    question_id: payload.questionId,
    reporter_id: payload.reporterId,
    reason: payload.reason,
    body: trimmedBody && trimmedBody.length > 0 ? trimmedBody : null,
  };

  const { error } = await client.from(CONTENT_REPORTS_TABLE).insert(insertPayload);
  if (!error) return;

  // 23505 = UNIQUE 違反。同じ人が同じ問題を通報済み。
  if (error.code === '23505') {
    throw new SubmitReportError('already_reported', 'この問題は既に通報済みです。');
  }
  // 42501 = permission denied、または RLS 違反。文字列判定でフォールバック。
  const message = error.message ?? '';
  if (error.code === '42501' || /row-level security|permission denied/i.test(message)) {
    throw new SubmitReportError(
      'blocked',
      '通報の乱用により、あなたのアカウントは通報機能を制限中です。運営にお問い合わせください。',
    );
  }

  throw new SubmitReportError('unknown', `通報の送信に失敗しました: ${message}`);
}

/**
 * ログイン中ユーザーが `reporter_blocks` に登録されているかを取得する。
 *
 * - 未接続 or ユーザー ID なし → `null`
 * - ブロック無し → `null`
 * - ブロック中 → `ReporterBlockRecord`
 *
 * RLS ポリシー (`self_read_own_block`) により、他人のブロック状態は取得できない。
 * このため、`reporter_id = userId` の検索は必然的に自分自身を対象にする。
 */
export async function fetchReporterBlockStatus(
  userId: string,
): Promise<ReporterBlockRecord | null> {
  const client = getSupabaseClient();
  if (!client || !userId) return null;

  const { data, error } = await client
    .from(REPORTER_BLOCKS_TABLE)
    .select('reporter_id, blocked_at, reason, auto_report_count')
    .eq('reporter_id', userId)
    .maybeSingle();

  if (error) {
    // reporter_blocks テーブル未作成 (42P01) 等の環境エラーは silent フォールバック。
    // 「ブロック無し」として扱い、UI を止めない。
    console.warn('[supabaseReportRepository] fetchReporterBlockStatus failed:', error.message);
    return null;
  }
  if (!data) return null;

  return {
    reporterId: data.reporter_id,
    blockedAt: data.blocked_at,
    reason: data.reason,
    autoReportCount: data.auto_report_count,
  };
}
