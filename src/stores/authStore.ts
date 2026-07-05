import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthRepository } from '@/lib/authRepository';
import { localAuthRepository } from '@/lib/localAuthRepository';
import type { LoginInput, SignupInput, User } from '@/types/account';
import { STORAGE_KEYS } from '@/lib/storage';
import { upsertPublicProfile } from '@/lib/supabasePublicProfileRepository';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface AuthState {
  currentUser: User | null;
  status: AuthStatus;
  errorMessage: string | null;

  signup: (input: SignupInput) => Promise<User>;
  login: (input: LoginInput) => Promise<User>;
  logout: () => void;
  clearError: () => void;
}

/**
 * 認証 Zustand ストア (`persist` で localStorage 同期)。
 *
 * 永続化されるのは `currentUser` のみ。トランジエントな `status` / `errorMessage` は
 * リロードで初期化される。
 *
 * リポジトリ層はテスト容易性のためファクトリ経由でも生成できる。
 */
export function createAuthStore(repository: AuthRepository = localAuthRepository) {
  return create<AuthState>()(
    persist(
      (set) => ({
        currentUser: null,
        status: 'idle',
        errorMessage: null,

        signup: async (input) => {
          set({ status: 'loading', errorMessage: null });
          try {
            const user = await repository.signup(input);
            // ランキング共有のため公開プロフィールを Supabase に upsert する。
            // Supabase 未接続時は no-op、失敗しても signup は成功扱い。
            void upsertPublicProfile(user);
            set({ currentUser: user, status: 'success', errorMessage: null });
            return user;
          } catch (err) {
            const message = err instanceof Error ? err.message : '登録に失敗しました。';
            set({ status: 'error', errorMessage: message });
            throw err;
          }
        },

        login: async (input) => {
          set({ status: 'loading', errorMessage: null });
          try {
            const user = await repository.login(input);
            // 別端末での初回ログイン等でプロフィールが Supabase に無いケースに備え、
            // ログイン成功時にも upsert する (冪等)。
            void upsertPublicProfile(user);
            set({ currentUser: user, status: 'success', errorMessage: null });
            return user;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'ログインに失敗しました。';
            set({ status: 'error', errorMessage: message });
            throw err;
          }
        },

        logout: () => {
          set({ currentUser: null, status: 'idle', errorMessage: null });
        },

        clearError: () => {
          set({ status: 'idle', errorMessage: null });
        },
      }),
      {
        name: STORAGE_KEYS.authState,
        storage: createJSONStorage(() => localStorage),
        // 永続化対象は currentUser のみ
        partialize: (state) => ({ currentUser: state.currentUser }),
      },
    ),
  );
}

export const useAuthStore = createAuthStore();
