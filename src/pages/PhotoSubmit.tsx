import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { useAuthStore } from '@/stores/authStore';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';
import { canSubmit } from '@/lib/photoQuestionRepository';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { RateLimitError } from '@/lib/supabasePhotoQuestionRepository';
import {
  ImageOptimizationError,
  formatBytes,
  optimizeImage,
  type OptimizedImage,
} from '@/lib/imageOptimizer';
import { PREFECTURES, isValidPrefecture, type Prefecture } from '@/data/prefectures';
import {
  DIFFICULTY_OPTIONS,
  NOODLE_THICKNESS_OPTIONS,
  PHOTO_QUIZ_QUESTION_TEXT,
  PHOTO_TYPE_OPTIONS,
  RAMEN_TYPE_OPTIONS,
  type NoodleThickness,
  type PhotoDifficulty,
  type PhotoType,
  type RamenType,
} from '@/types/photoQuestion';
import type { PhotoQuestionSubmission } from '@/lib/photoQuestionRepository';

/** 写真クイズ投稿フォームのテキスト系最大文字数。 */
const OPTION_MAX = 50;
const EXPLANATION_MAX = 200;
const SHOP_FIELD_MAX = 50;
const SHOP_NAME_MIN = 1;

interface FormErrors {
  image?: string;
  ramenType?: string;
  prefecture?: string;
  photoType?: string;
  difficulty?: string;
  noodleThickness?: string;
  options?: string[];
  answerIdx?: string;
  explanation?: string;
  shopName?: string;
  shopArea?: string;
  shopDescription?: string;
  form?: string;
}

/**
 * ユーザー写真クイズ投稿ページ。
 *
 * - ログイン必須 (未ログインなら `/login?redirect=/quiz/photo/submit` へ)
 * - 画像をクライアントサイドで WebP 最適化してから Supabase Storage に PUT
 * - Supabase 未接続時は送信ボタンを無効化し「社長作業待ち」表示
 */
export function PhotoSubmit(): JSX.Element {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);

  // 未ログインなら redirect 付きでログインページへ
  if (!currentUser) {
    return <Navigate to="/login?redirect=/quiz/photo/submit" replace />;
  }

  return <PhotoSubmitForm submitterId={currentUser.username} onSuccess={() => navigate('/quiz/photo')} />;
}

interface PhotoSubmitFormProps {
  submitterId: string;
  onSuccess: () => void;
}

function PhotoSubmitForm({ submitterId, onSuccess }: PhotoSubmitFormProps): JSX.Element {
  const supabaseReady = useMemo(() => isSupabaseConfigured(), []);

  // 画像状態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [optimized, setOptimized] = useState<OptimizedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // メタ情報 5 軸
  const [ramenType, setRamenType] = useState<RamenType | ''>('');
  const [prefecture, setPrefecture] = useState<string>('');
  const [photoType, setPhotoType] = useState<PhotoType | ''>('');
  const [difficulty, setDifficulty] = useState<PhotoDifficulty | ''>('');
  const [noodleThickness, setNoodleThickness] = useState<NoodleThickness | ''>('');

  // テキスト (問題文は全問共通の固定文字列なのでステートに持たない)
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [answerIdx, setAnswerIdx] = useState<number>(0);
  const [explanation, setExplanation] = useState('');

  // 店舗情報 (店名は必須、その他は任意)
  const [shopName, setShopName] = useState('');
  const [shopArea, setShopArea] = useState('');
  const [shopDescription, setShopDescription] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // プレビュー URL の解放
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  // ファイル選択 → 最適化を一括処理
  const handleFileSelected = async (file: File | null) => {
    setImageError(null);
    setOptimized(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setIsOptimizing(true);
    try {
      const result = await optimizeImage(file);
      setOptimized(result);
    } catch (err) {
      if (err instanceof ImageOptimizationError) {
        setImageError(err.message);
      } else {
        setImageError('画像の最適化に失敗しました。別の画像をお試しください。');
      }
      setOptimized(null);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    void handleFileSelected(file);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void handleFileSelected(file);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // 選択肢更新
  const handleOptionChange = (idx: number, value: string) => {
    setOptions((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  // リアルタイムバリデーション (errors を表示するために即時反映)
  useEffect(() => {
    const next: FormErrors = {};

    const optionErrs: string[] = ['', '', '', ''];
    options.forEach((opt, i) => {
      if (opt.trim().length === 0) optionErrs[i] = '選択肢を入力してください。';
      else if (opt.length > OPTION_MAX) optionErrs[i] = `${OPTION_MAX} 字以内で入力してください。`;
    });
    if (optionErrs.some((e) => e.length > 0)) next.options = optionErrs;

    if (ramenType === '') next.ramenType = 'ラーメンの種類を選択してください。';
    if (prefecture === '' || !isValidPrefecture(prefecture)) next.prefecture = '都道府県を選択してください。';
    if (photoType === '') next.photoType = '写真の種類を選択してください。';
    if (difficulty === '') next.difficulty = '難易度を選択してください。';

    if (explanation.length > EXPLANATION_MAX) {
      next.explanation = `解説は ${EXPLANATION_MAX} 字以内で入力してください。`;
    }

    // 店名は必須 (1〜SHOP_FIELD_MAX 字)
    const trimmedShopName = shopName.trim();
    if (trimmedShopName.length < SHOP_NAME_MIN) {
      next.shopName = '店名を入力してください。';
    } else if (trimmedShopName.length > SHOP_FIELD_MAX) {
      next.shopName = `${SHOP_FIELD_MAX} 字以内で入力してください。`;
    }
    if (shopArea.length > SHOP_FIELD_MAX) next.shopArea = `${SHOP_FIELD_MAX} 字以内で入力してください。`;
    if (shopDescription.length > SHOP_FIELD_MAX) {
      next.shopDescription = `${SHOP_FIELD_MAX} 字以内で入力してください。`;
    }

    if (answerIdx < 0 || answerIdx > 3) next.answerIdx = '正解の選択肢を選んでください。';

    setErrors(next);
  }, [
    options,
    ramenType,
    prefecture,
    photoType,
    difficulty,
    explanation,
    shopName,
    shopArea,
    shopDescription,
    answerIdx,
  ]);

  const hasFieldErrors = Object.keys(errors).length > 0;
  const isFormReady =
    !hasFieldErrors &&
    !!optimized &&
    !imageError &&
    submitState !== 'submitting' &&
    supabaseReady;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!optimized) {
      setImageError('画像を選択してください。');
      return;
    }
    if (hasFieldErrors) return;
    if (!supabaseReady) {
      setSubmitError('Supabase が未接続のため投稿できません。社長の作業をお待ちください。');
      return;
    }

    // ガード: 型を絞る
    if (
      ramenType === '' ||
      photoType === '' ||
      difficulty === '' ||
      !isValidPrefecture(prefecture)
    ) {
      return;
    }

    // 店名は必須項目 (バリデーション通過済みなので空ではない前提)
    const shopInfo: PhotoQuestionSubmission['shopInfo'] = {
      name: shopName.trim(),
    };
    if (shopArea.trim()) shopInfo.area = shopArea.trim();
    if (shopDescription.trim()) shopInfo.description = shopDescription.trim();

    const submission: PhotoQuestionSubmission = {
      submitterId,
      ramenType,
      prefecture: prefecture as Prefecture,
      photoType,
      difficulty,
      noodleThickness: noodleThickness === '' ? undefined : noodleThickness,
      options: options.map((o) => o.trim()),
      answerIdx,
      explanation: explanation.trim() ? explanation.trim() : undefined,
      shopInfo,
    };

    if (!canSubmit(compositePhotoQuestionRepository)) {
      setSubmitError('投稿リポジトリが利用できません。');
      return;
    }

    setSubmitState('submitting');
    try {
      await compositePhotoQuestionRepository.submit(submission, optimized.blob);
      setSubmitState('success');
      setToast('投稿しました');
      // 1 秒だけトーストを見せてから一覧へ
      window.setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setSubmitError(formatRateLimitMessage(err.retryAfterSeconds));
      } else {
        const message = err instanceof Error ? err.message : '投稿に失敗しました。';
        setSubmitError(message);
      }
      setSubmitState('error');
    }
  };

  return (
    <div className="space-y-6">
      <Seo
        title="写真クイズを投稿する"
        description="あなたが撮ったラーメン写真でクイズを作って投稿しましょう。"
        url="/quiz/photo/submit"
        noIndex
      />

      <div className="card">
        <h1 className="text-2xl font-black text-ramen-soy">写真クイズを投稿する</h1>
        <p className="mt-2 text-sm text-ramen-soy/70">
          あなたが撮ったラーメン写真で 4 択クイズを作ろう。送信前に画像はブラウザ内で WebP に変換され、長辺
          800px までリサイズされます。EXIF (位置情報) は自動的に削除されます。
        </p>
      </div>

      {!supabaseReady ? (
        <div className="card border-2 border-ramen-chili/40 bg-ramen-chili/5">
          <p className="text-sm font-bold text-ramen-chili">
            Supabase 未接続。社長作業待ち
          </p>
          <p className="mt-1 text-xs text-ramen-soy/70">
            投稿先のサーバー (Supabase) が未設定のため、現在は投稿を受け付けられません。
            <code className="mx-1 rounded bg-white px-1 py-0.5">.env.local</code> を設定後にお試しください。
          </p>
        </div>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {/* 画像選択 */}
        <section className="card space-y-3">
          <h2 className="text-base font-bold text-ramen-soy">画像</h2>

          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              isDragOver
                ? 'border-ramen-chili bg-ramen-chili/5'
                : 'border-ramen-soy/30 bg-white/60 hover:border-ramen-chili/60'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFileInputChange}
            />
            <span className="text-sm font-bold text-ramen-soy">
              クリック or ドラッグ＆ドロップで画像を選択
            </span>
            <span className="mt-1 text-xs text-ramen-soy/60">
              JPEG / PNG / WebP、5MB まで
            </span>
          </label>

          {isOptimizing ? (
            <p className="text-xs text-ramen-soy/70">画像を最適化しています...</p>
          ) : null}

          {imageError ? (
            <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
              {imageError}
            </p>
          ) : null}

          {previewUrl && optimized ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold text-ramen-soy/70">プレビュー</p>
                <img
                  src={previewUrl}
                  alt="アップロードした画像のプレビュー"
                  className="max-h-60 w-full rounded-xl border border-ramen-soy/10 object-contain"
                />
              </div>
              <div className="space-y-1 text-xs text-ramen-soy/80">
                <p className="font-bold text-ramen-soy">最適化結果</p>
                <p>
                  サイズ: {formatBytes(optimized.originalSizeBytes)} →{' '}
                  <span className="font-bold text-ramen-soy">
                    {formatBytes(optimized.optimizedSizeBytes)}
                  </span>
                </p>
                <p>
                  寸法: {optimized.originalWidth}×{optimized.originalHeight} →{' '}
                  <span className="font-bold text-ramen-soy">
                    {optimized.optimizedWidth}×{optimized.optimizedHeight}
                  </span>
                </p>
                <p className="text-ramen-soy/60">
                  形式: WebP (Q=0.85) / EXIF 削除済み
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* 5軸メタ */}
        <section className="card space-y-4">
          <h2 className="text-base font-bold text-ramen-soy">メタ情報</h2>

          <SelectField id="submit-ramen-type" label="ラーメンの種類" error={errors.ramenType}>
            <select
              id="submit-ramen-type"
              className="input"
              value={ramenType}
              onChange={(e) => setRamenType(e.target.value as RamenType | '')}
              required
            >
              <option value="">選択してください</option>
              {RAMEN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField id="submit-prefecture" label="都道府県" error={errors.prefecture}>
            <select
              id="submit-prefecture"
              className="input"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField id="submit-photo-type" label="写真の種類" error={errors.photoType}>
            <select
              id="submit-photo-type"
              className="input"
              value={photoType}
              onChange={(e) => setPhotoType(e.target.value as PhotoType | '')}
              required
            >
              <option value="">選択してください</option>
              {PHOTO_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField id="submit-difficulty" label="難易度" error={errors.difficulty}>
            <select
              id="submit-difficulty"
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as PhotoDifficulty | '')}
              required
            >
              <option value="">選択してください</option>
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField
            id="submit-noodle-thickness"
            label="麺の太さ (任意)"
            error={errors.noodleThickness}
          >
            <select
              id="submit-noodle-thickness"
              className="input"
              value={noodleThickness}
              onChange={(e) => setNoodleThickness(e.target.value as NoodleThickness | '')}
            >
              <option value="">指定なし</option>
              {NOODLE_THICKNESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SelectField>
        </section>

        {/* 問題文と選択肢 */}
        <section className="card space-y-4">
          <h2 className="text-base font-bold text-ramen-soy">問題</h2>

          <div className="space-y-1">
            <p className="block text-sm font-bold text-ramen-soy">問題文 (全問共通・編集不可)</p>
            <p className="rounded-xl border border-ramen-soy/10 bg-ramen-broth/10 px-3 py-2 text-sm text-ramen-soy">
              {PHOTO_QUIZ_QUESTION_TEXT}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-ramen-soy">選択肢と正解 (各最大 {OPTION_MAX} 字)</legend>
            {options.map((value, idx) => (
              <div key={idx} className="space-y-1">
                <label
                  htmlFor={`submit-option-${idx}`}
                  className="flex items-center gap-2 text-sm text-ramen-soy"
                >
                  <input
                    type="radio"
                    name="submit-answer"
                    className="accent-ramen-chili"
                    checked={answerIdx === idx}
                    onChange={() => setAnswerIdx(idx)}
                    aria-label={`選択肢 ${idx + 1} を正解にする`}
                  />
                  <span className="font-bold">選択肢 {idx + 1}</span>
                  <span className="text-xs text-ramen-soy/60">
                    ({value.length}/{OPTION_MAX})
                  </span>
                </label>
                <input
                  id={`submit-option-${idx}`}
                  type="text"
                  className="input"
                  value={value}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  maxLength={OPTION_MAX + 10}
                  required
                />
                {errors.options?.[idx] ? (
                  <p className="text-xs font-bold text-ramen-chili">{errors.options[idx]}</p>
                ) : null}
              </div>
            ))}
            {errors.answerIdx ? (
              <p className="text-xs font-bold text-ramen-chili">{errors.answerIdx}</p>
            ) : null}
          </fieldset>

          <div className="space-y-1">
            <label htmlFor="submit-explanation" className="block text-sm font-bold text-ramen-soy">
              解説 ({explanation.length}/{EXPLANATION_MAX}) ・任意
            </label>
            <textarea
              id="submit-explanation"
              className="input min-h-[4rem]"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={EXPLANATION_MAX + 20}
              rows={3}
              placeholder="正解の根拠や豆知識をどうぞ"
            />
            {errors.explanation ? (
              <p className="text-xs font-bold text-ramen-chili">{errors.explanation}</p>
            ) : null}
          </div>
        </section>

        {/* 店舗情報 (店名は必須) */}
        <section className="card space-y-4">
          <h2 className="text-base font-bold text-ramen-soy">店舗情報</h2>
          <p className="text-xs text-ramen-soy/70">
            問題文が「この画像はどこの店のものですか？」で統一されているため、店名は必須項目です。
          </p>

          <TextField
            id="submit-shop-name"
            label="店名 (必須)"
            value={shopName}
            onChange={setShopName}
            max={SHOP_FIELD_MAX}
            error={errors.shopName}
            placeholder="例) ラーメン二郎 三田本店"
            required
          />
          <TextField
            id="submit-shop-area"
            label="エリア (任意)"
            value={shopArea}
            onChange={setShopArea}
            max={SHOP_FIELD_MAX}
            error={errors.shopArea}
            placeholder="例) 港区三田"
          />
          <TextField
            id="submit-shop-description"
            label="店舗詳細・補足 (任意)"
            value={shopDescription}
            onChange={setShopDescription}
            max={SHOP_FIELD_MAX}
            error={errors.shopDescription}
            placeholder="例) 1968 年創業の二郎系総本山"
          />
        </section>

        {submitError ? (
          <p className="rounded-lg bg-ramen-chili/10 px-3 py-2 text-sm font-bold text-ramen-chili">
            {submitError}
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          <button
            type="submit"
            className="btn-primary w-full sm:w-auto"
            disabled={!isFormReady}
            aria-disabled={!isFormReady}
          >
            {submitState === 'submitting' ? '送信中...' : '投稿する'}
          </button>
          {!supabaseReady ? (
            <p className="text-xs font-bold text-ramen-chili">
              Supabase 未接続。社長作業待ち
            </p>
          ) : null}
          <Link to="/quiz/photo" className="text-xs text-ramen-soy/70 hover:underline">
            ← 写真当てクイズへ戻る
          </Link>
        </div>
      </form>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ramen-soy px-6 py-3 text-sm font-bold text-white shadow-xl"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/**
 * レート制限時の残り秒数を「あと N 分 M 秒」形式に整形する。
 * - 60 秒未満は「あと N 秒」
 * - それ以外は「あと N 分 M 秒」 (秒部分が 0 のときは省略)
 */
function formatRateLimitMessage(retryAfterSeconds: number): string {
  const total = Math.max(1, Math.ceil(retryAfterSeconds));
  if (total < 60) {
    return `投稿のレート制限により、あと ${total} 秒お待ちください。`;
  }
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const remainder = seconds > 0 ? ` ${seconds} 秒` : '';
  return `投稿のレート制限により、あと ${minutes} 分${remainder}お待ちください。`;
}

interface SelectFieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

function SelectField({ id, label, error, children }: SelectFieldProps): JSX.Element {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-bold text-ramen-soy">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs font-bold text-ramen-chili">{error}</p> : null}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

function TextField({
  id,
  label,
  value,
  onChange,
  max,
  error,
  placeholder,
  required = false,
}: TextFieldProps): JSX.Element {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-bold text-ramen-soy">
        {label} ({value.length}/{max})
      </label>
      <input
        id={id}
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max + 10}
        placeholder={placeholder}
        required={required}
      />
      {error ? <p className="text-xs font-bold text-ramen-chili">{error}</p> : null}
    </div>
  );
}
