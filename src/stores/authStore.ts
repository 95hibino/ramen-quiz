import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthRepository } from '@/lib/authRepository';
import { compositeAuthRepository } from '@/lib/compositeAuthRepository';
import { restoreCurrentUser, supabaseLogout } from '@/lib/supabaseAuthRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import type { LoginInput, SignupInput, User } from '@/types/account';
import { STORAGE_KEYS } from '@/lib/storage';

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';

interface AuthState {
  currentUser: User | null;
  status: AuthStatus;
  errorMessage: string | null;

  signup: (input: SignupInput) => Promise<User>;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  clearError: () => void;

  /**
   * mount 時に Supabase Auth のセッションから currentUser を復元する。
   * Supabase 未接続時は persist 済みの localStorage `currentUser` をそのまま維持する。
   *
   * Supabase 接続時に localStorage 側の currentUser があってもセッションが無ければ、
   * 「旧 localStorage 認証ユーザー」なのでクリアして再ログインを促す。
   */
  syncFromSession: () => Promise<void>;
}

/**
 * 認証 Zustand ストア。
 *
 * Phase 3 で Supabase Auth に移行:
 * - `signup` / `login` / `logout` は本体 (compositeAuthRepository) 経由。
 *   Supabase 接続時は `auth.uid()` ベースのセッションが張られる。
 * - `currentUser` は永続化する (UI の即時表示用)。真実のセッションは Supabase Auth 側の
 *   `ramen-quiz:supabase-auth` に保存されている。
 * - mount 時に `syncFromSession()` を呼び、Supabase セッションと currentUser を同期する。
 */
export function createAuthStore(repository: AuthRepository = compositeAuthRepository) {
  return create<AuthState>()(
    persist(
      (set, get) => ({
        currentUser: null,
        status: 'idle',
        errorMessage: null,

        signup: async (input) => {
          set({ status: 'loading', errorMessage: null });
          try {
            // supabaseAuthRepository.signup が SECURITY DEFINER 関数 (§13) 経由で
            // 確実に public_profiles に upsert する。localAuthRepository 経路 (Supabase
            // 未接続時) は localStorage 完結なので upsert 不要。
            // → authStore 側での重複 upsert (以前は冗長に呼んでいた) を削除。
            const user = await repository.signup(input);
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
            // login 時の profile upsert は supabaseAuthRepository.login の
            // 自己修復ロジック内で必要時のみ実行される。
            const user = await repository.login(input);
            set({ currentUser: user, status: 'success', errorMessage: null });
            return user;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'ログインに失敗しました。';
            set({ status: 'error', errorMessage: message });
            throw err;
          }
        },

        logout: async () => {
          // Supabase セッションもクリアする。ローカル運用時は no-op。
          try {
            await supabaseLogout();
          } catch (err) {
            console.warn('[authStore] supabaseLogout failed:', err);
          }
          set({ currentUser: null, status: 'idle', errorMessage: null });
        },

        clearError: () => {
          set({ status: 'idle', errorMessage: null });
        },

        syncFromSession: async () => {
          // Supabase 未接続時: localStorage 側の currentUser をそのまま採用 (旧挙動維持)
          if (!isSupabaseConfigured()) return;

          try {
            const user = await restoreCurrentUser();
            if (user) {
              set({ currentUser: user });
              return;
            }
            // Supabase セッション無し。persist 済みの currentUser がいるならレガシー扱いで破棄。
            if (get().currentUser) {
              console.info(
                '[authStore] レガシー localStorage セッションを検出。Supabase セッションが無いためクリアします。',
              );
              set({ currentUser: null });
            }
          } catch (err) {
            console.warn('[authStore] syncFromSession failed:', err);
          }
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
