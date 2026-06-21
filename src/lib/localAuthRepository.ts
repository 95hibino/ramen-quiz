import {
  AuthError,
  type LoginInput,
  type PasswordCredential,
  type SignupInput,
  type User,
} from '@/types/account';
import { isValidPrefecture } from '@/data/prefectures';
import { deriveSalt, hashPassword, safeEqual } from '@/lib/passwordHash';
import { generateId, readJson, STORAGE_KEYS, writeJson } from '@/lib/storage';
import {
  validateFavoriteShop,
  validatePassword,
  validatePrefecture,
  validateUsername,
} from '@/lib/validation';
import type { AuthRepository } from '@/lib/authRepository';

/** ユーザー名の正規化 (重複判定で使用)。 */
function normalizeUsername(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase();
}

function loadUsers(): User[] {
  return readJson<User[]>(STORAGE_KEYS.users, []);
}

function saveUsers(users: User[]): void {
  writeJson(STORAGE_KEYS.users, users);
}

function loadCredentials(): PasswordCredential[] {
  return readJson<PasswordCredential[]>(STORAGE_KEYS.credentials, []);
}

function saveCredentials(creds: PasswordCredential[]): void {
  writeJson(STORAGE_KEYS.credentials, creds);
}

/**
 * localStorage を永続層とする AuthRepository 実装。
 * Phase 3 で Supabase 実装に差し替え可能。
 */
export const localAuthRepository: AuthRepository = {
  async signup(input: SignupInput): Promise<User> {
    const username = input.username.trim();
    const favoriteShop = input.favoriteShop.trim();
    const prefecture = input.prefecture;

    const usernameErr = validateUsername(username);
    if (usernameErr) throw new AuthError('validation_error', usernameErr);

    const passwordErr = validatePassword(input.password);
    if (passwordErr) throw new AuthError('validation_error', passwordErr);

    const prefectureErr = validatePrefecture(prefecture);
    if (prefectureErr) throw new AuthError('validation_error', prefectureErr);

    const favoriteShopErr = validateFavoriteShop(favoriteShop);
    if (favoriteShopErr) throw new AuthError('validation_error', favoriteShopErr);

    if (!isValidPrefecture(prefecture)) {
      throw new AuthError('validation_error', '都道府県の選択が不正です。');
    }

    const users = loadUsers();
    const normalized = normalizeUsername(username);
    if (users.some((u) => normalizeUsername(u.username) === normalized)) {
      throw new AuthError('username_taken', 'このユーザー名は既に使われています。');
    }

    const salt = deriveSalt(username);
    const passwordHash = await hashPassword(input.password, salt);

    const newUser: User = {
      id: generateId(),
      username,
      prefecture,
      favoriteShop,
      createdAt: new Date().toISOString(),
    };

    saveUsers([...users, newUser]);

    const creds = loadCredentials();
    saveCredentials([
      ...creds,
      { userId: newUser.id, passwordHash, salt },
    ]);

    return newUser;
  },

  async login(input: LoginInput): Promise<User> {
    const username = input.username.trim();
    if (username.length === 0 || input.password.length === 0) {
      throw new AuthError('invalid_credentials', 'ユーザー名とパスワードを入力してください。');
    }

    const users = loadUsers();
    const normalized = normalizeUsername(username);
    const user = users.find((u) => normalizeUsername(u.username) === normalized);
    if (!user) {
      throw new AuthError('invalid_credentials', 'ユーザー名またはパスワードが違います。');
    }

    const creds = loadCredentials();
    const cred = creds.find((c) => c.userId === user.id);
    if (!cred) {
      throw new AuthError('invalid_credentials', 'ユーザー名またはパスワードが違います。');
    }

    const hash = await hashPassword(input.password, cred.salt);
    if (!safeEqual(hash, cred.passwordHash)) {
      throw new AuthError('invalid_credentials', 'ユーザー名またはパスワードが違います。');
    }

    return user;
  },

  async isUsernameTaken(username: string): Promise<boolean> {
    const normalized = normalizeUsername(username);
    if (normalized.length === 0) return false;
    return loadUsers().some((u) => normalizeUsername(u.username) === normalized);
  },

  async findUserById(userId: string): Promise<User | null> {
    return loadUsers().find((u) => u.id === userId) ?? null;
  },

  async listUsers(): Promise<User[]> {
    return loadUsers();
  },
};
