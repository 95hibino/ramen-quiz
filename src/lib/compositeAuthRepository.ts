/**
 * Supabase Auth を優先し、未接続時のみ localAuthRepository にフォールバックする合成リポジトリ。
 *
 * 環境変数が設定されて Supabase に接続できる本番/開発環境では常に Supabase Auth を使い、
 * ユーザー ID = `auth.uid()` の関係性を保つ。ローカルの完全オフライン開発
 * (VITE_SUPABASE_URL 未設定) では従来通り localAuthRepository で動作する。
 *
 * 呼び出し側 (authStore) は本モジュールを直接依存するだけで、
 * 環境差を意識せずに書ける。
 */
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { localAuthRepository } from '@/lib/localAuthRepository';
import { supabaseAuthRepository } from '@/lib/supabaseAuthRepository';
import type { AuthRepository } from '@/lib/authRepository';
import type { LoginInput, SignupInput, User } from '@/types/account';
import { AuthError } from '@/types/account';

function pick(): AuthRepository {
  return isSupabaseConfigured() ? supabaseAuthRepository : localAuthRepository;
}

export const compositeAuthRepository: AuthRepository = {
  async signup(input: SignupInput): Promise<User> {
    return pick().signup(input);
  },
  async login(input: LoginInput): Promise<User> {
    return pick().login(input);
  },
  async isUsernameTaken(username: string): Promise<boolean> {
    return pick().isUsernameTaken(username);
  },
  async findUserById(userId: string): Promise<User | null> {
    return pick().findUserById(userId);
  },
  async listUsers(): Promise<User[]> {
    return pick().listUsers();
  },
  /**
   * 復旧コードは Supabase の SECURITY DEFINER 関数に依存するため、
   * オフライン (localAuthRepository) では提供しない。
   * 呼び出し側は `canUseRecoveryCode()` で対応可否を判定すること。
   */
  async issueRecoveryCode(): Promise<string> {
    const repo = pick();
    if (!repo.issueRecoveryCode) {
      throw new AuthError('unknown', 'この環境では復旧コードを利用できません。');
    }
    return repo.issueRecoveryCode();
  },
  async resetPasswordWithRecoveryCode(input: {
    username: string;
    recoveryCode: string;
    newPassword: string;
  }): Promise<string> {
    const repo = pick();
    if (!repo.resetPasswordWithRecoveryCode) {
      throw new AuthError('unknown', 'この環境では復旧コードを利用できません。');
    }
    return repo.resetPasswordWithRecoveryCode(input);
  },
};

/** 現在の環境 (Supabase 接続済みか) で復旧コードが使えるか。 */
export function isRecoveryCodeAvailable(): boolean {
  return isSupabaseConfigured();
}
