import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/common/Seo';
import { AdBanner } from '@/components/common/AdBanner';
import { ReporterBlockedScreen } from '@/components/quiz/ReporterBlockedScreen';
import { compositePhotoQuestionRepository } from '@/lib/compositePhotoQuestionRepository';
import { usePhotoQuizStore } from '@/stores/photoQuizStore';
import { useReporterBlockStatus } from '@/hooks/useReporterBlockStatus';
import { PREFECTURES, type Prefecture } from '@/data/prefectures';
import {
  DIFFICULTY_OPTIONS,
  NOODLE_THICKNESS_OPTIONS,
  PHOTO_TYPE_OPTIONS,
  RAMEN_TYPE_OPTIONS,
  type NoodleThickness,
  type PhotoDifficulty,
  type PhotoQuestionFilter,
  type PhotoType,
  type RamenType,
} from '@/types/photoQuestion';

/**
 * 写真当てクイズ開始画面 (5 軸絞り込み)。
 *
 * - 同軸内 OR / 異なる軸間 AND の評価
 * - 何も選択しなければ全件対象
 * - 0 問のときはスタートボタンを無効化
 */
export function PhotoQuiz(): JSX.Element {
  const navigate = useNavigate();
  const setFilter = usePhotoQuizStore((s) => s.setFilter);
  const startSession = usePhotoQuizStore((s) => s.startSession);
  const blockStatus = useReporterBlockStatus();

  const [ramenTypes, setRamenTypes] = useState<RamenType[]>([]);
  const [prefectures, setPrefectures] = useState<Prefecture[]>([]);
  const [photoTypes, setPhotoTypes] = useState<PhotoType[]>([]);
  const [difficulties, setDifficulties] = useState<PhotoDifficulty[]>([]);
  const [noodleThicknesses, setNoodleThicknesses] = useState<NoodleThickness[]>([]);

  const filter: PhotoQuestionFilter = useMemo(
    () => ({
      ramenTypes: ramenTypes.length > 0 ? ramenTypes : undefined,
      prefectures: prefectures.length > 0 ? prefectures : undefined,
      photoTypes: photoTypes.length > 0 ? photoTypes : undefined,
      difficulties: difficulties.length > 0 ? difficulties : undefined,
      noodleThicknesses: noodleThicknesses.length > 0 ? noodleThicknesses : undefined,
    }),
    [ramenTypes, prefectures, photoTypes, difficulties, noodleThicknesses],
  );

  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrefectures, setShowPrefectures] = useState(false);

  // リアルタイム件数表示。フィルタ変更ごとに再カウント。
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void compositePhotoQuestionRepository.countByFilter(filter).then((count) => {
      if (!cancelled) {
        setAvailableCount(count);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const handleStart = async () => {
    setFilter(filter);
    await startSession();
    navigate('/quiz/photo/play');
  };

  const handleReset = () => {
    setRamenTypes([]);
    setPrefectures([]);
    setPhotoTypes([]);
    setDifficulties([]);
    setNoodleThicknesses([]);
    setShowPrefectures(false);
  };

  const isStartDisabled = availableCount === null || availableCount === 0;

  // 通報乱用でブロックされたユーザーは通常の UI を全て隠す (プレイ導線を塞ぐ)。
  // ローディング中は何も描画しない (ちらつき防止)。
  if (blockStatus.state === 'blocked') {
    return (
      <div className="space-y-6">
        <Seo title="写真当てクイズ" description="写真当てクイズ" url="/quiz/photo" noIndex />
        <ReporterBlockedScreen block={blockStatus.block} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Seo
        title="写真当てクイズ"
        description="ラーメン写真当てクイズ。お店の外観や麺・スープの写真から店舗・系統・都道府県を当てよう。種類・地域・写真タイプ・難易度・麺の太さの 5 軸で絞り込み可能。"
        url="/quiz/photo"
        keywords={['ラーメン', '写真クイズ', '写真当てクイズ', 'ご当地ラーメン', 'ラーメン店舗当て']}
      />

      <AdBanner slot="photo-quiz-top" size="leaderboard" />

      <div className="card">
        <h1 className="text-2xl font-black text-ramen-soy">写真当てクイズ</h1>
        <p className="mt-2 text-sm text-ramen-soy/70">
          ラーメンの写真からお店・系統・都道府県を当てよう。
          <br />
          1セッション 10 問・各 30 秒。条件を絞らなければ全問題からランダム出題します。
        </p>
        <p className="mt-2 text-xs text-ramen-soy/60">
          ※ 現在は仮の写真素材で動作確認中です。実画像は順次差し替え予定です。
        </p>
      </div>

      <CheckboxGroup
        title="ラーメンの種類"
        options={RAMEN_TYPE_OPTIONS}
        selected={ramenTypes}
        onChange={setRamenTypes}
      />

      <CheckboxGroup
        title="写真の種類"
        options={PHOTO_TYPE_OPTIONS}
        selected={photoTypes}
        onChange={setPhotoTypes}
      />

      <CheckboxGroup
        title="難易度"
        options={DIFFICULTY_OPTIONS}
        selected={difficulties}
        onChange={setDifficulties}
      />

      <CheckboxGroup
        title="麺の太さ"
        options={NOODLE_THICKNESS_OPTIONS}
        selected={noodleThicknesses}
        onChange={setNoodleThicknesses}
      />

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ramen-soy">所在地（都道府県）</h2>
          <button
            type="button"
            onClick={() => setShowPrefectures((v) => !v)}
            className="text-xs font-bold text-ramen-chili hover:underline"
          >
            {showPrefectures ? '閉じる ▲' : '47都道府県を表示 ▼'}
          </button>
        </div>
        {prefectures.length > 0 ? (
          <p className="text-xs text-ramen-soy/70">
            選択中: <span className="font-bold">{prefectures.join('、')}</span>
          </p>
        ) : (
          <p className="text-xs text-ramen-soy/60">未選択（全都道府県対象）</p>
        )}
        {showPrefectures ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {PREFECTURES.map((pref) => {
              const checked = prefectures.includes(pref);
              return (
                <label
                  key={pref}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                    checked
                      ? 'border-ramen-chili bg-ramen-chili/10 font-bold text-ramen-chili'
                      : 'border-ramen-soy/20 bg-white text-ramen-soy/80 hover:border-ramen-chili/60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-ramen-chili"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPrefectures([...prefectures, pref]);
                      } else {
                        setPrefectures(prefectures.filter((p) => p !== pref));
                      }
                    }}
                  />
                  <span>{pref}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="card space-y-3 text-center">
        <p className="text-sm text-ramen-soy/70">
          {isLoading
            ? '集計中...'
            : availableCount === null
              ? '— 問利用可能'
              : `${availableCount} 問利用可能`}
        </p>
        {availableCount === 0 ? (
          <p className="text-sm font-bold text-ramen-chili">条件を緩めてください。</p>
        ) : null}
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isStartDisabled}
          >
            クイズスタート
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary">
            条件をリセット
          </button>
        </div>
        <div>
          <Link to="/" className="text-xs text-ramen-soy/70 hover:underline">
            ← トップに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

interface CheckboxGroupProps<T extends string> {
  title: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: T[];
  onChange: (next: T[]) => void;
}

function CheckboxGroup<T extends string>({
  title,
  options,
  selected,
  onChange,
}: CheckboxGroupProps<T>): JSX.Element {
  return (
    <div className="card space-y-3">
      <h2 className="text-base font-bold text-ramen-soy">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm transition ${
                checked
                  ? 'border-ramen-chili bg-ramen-chili/10 font-bold text-ramen-chili'
                  : 'border-ramen-soy/20 bg-white text-ramen-soy/80 hover:border-ramen-chili/60'
              }`}
            >
              <input
                type="checkbox"
                className="accent-ramen-chili"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selected, opt.value]);
                  } else {
                    onChange(selected.filter((v) => v !== opt.value));
                  }
                }}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
      {selected.length === 0 ? (
        <p className="text-xs text-ramen-soy/60">未選択（すべて対象）</p>
      ) : null}
    </div>
  );
}
