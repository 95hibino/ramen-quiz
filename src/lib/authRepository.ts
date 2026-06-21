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
}
