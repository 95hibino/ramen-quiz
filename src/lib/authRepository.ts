import type { LoginInput, SignupInput, User } from '@/types/account';

/**
 * 認証ストレージの抽象インターフェース。
 *
 * Phase 1: `localAuthRepository` (localStorage 実装)。
 * Phase 3: Supabase 実装に差し替える際は本 interface だけを実装すればよい。
 *
 * すべてのメソッドは失敗時に `AuthError` (`@/types/account`) を throw する。
 */
export interface AuthRepository {
  /** 新規ユーザーを作成し、作成済みユーザーを返す。 */
  signup(input: SignupInput): Promise<User>;

  /** ユーザー名 + パスワードで認証し、ユーザーを返す。 */
  login(input: LoginInput): Promise<User>;

  /** ユーザー名の重複をチェックする (バリデーション用)。 */
  isUsernameTaken(username: string): Promise<boolean>;

  /** ユーザー ID から公開情報を取得する。 */
  findUserById(userId: string): Promise<User | null>;

  /** 全ユーザーの公開情報を取得する (ランキング画面用)。 */
  listUsers(): Promise<User[]>;

  /**
   * ログイン中ユーザーの復旧コードを新規発行し、**平文を 1 回だけ**返す (任意実装)。
   *
   * 既に発行済みの場合は上書きされ、古いコードは無効になる。
   * サーバ側 (`issue_recovery_code`) は bcrypt ハッシュしか保存しないため、
   * ここで返した文字列を取り逃すと二度と取得できない。
   * docs/SUPABASE_SETUP.md §23 参照。
   */
  issueRecoveryCode?(): Promise<string>;

  /**
   * 復旧コードでパスワードを再設定する (未ログインから呼ぶ、任意実装)。
   *
   * 成功すると**新しい**復旧コードを返す (古いコードは使い切りで無効になる)。
   * 全端末のセッションが破棄されるため、呼び出し後は再ログインが必要。
   */
  resetPasswordWithRecoveryCode?(input: {
    username: string;
    recoveryCode: string;
    newPassword: string;
  }): Promise<string>;
}

/** リポジトリが復旧コード機能に対応しているかの型ガード。 */
export function canUseRecoveryCode(
  repo: AuthRepository,
): repo is AuthRepository &
  Required<Pick<AuthRepository, 'issueRecoveryCode' | 'resetPasswordWithRecoveryCode'>> {
  return (
    typeof repo.issueRecoveryCode === 'function' &&
    typeof repo.resetPasswordWithRecoveryCode === 'function'
  );
}
