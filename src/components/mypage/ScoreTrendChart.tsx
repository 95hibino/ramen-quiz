/**
 * スコア推移グラフ (recharts)。
 *
 * マイページから React.lazy で遅延ロードする想定。recharts が 100KB 近く
 * あるため、初期表示には含めず MyPage 表示時のみバンドルされる。
 *
 * 表示仕様:
 * - X 軸: プレイ日 (MM/DD)
 * - Y 軸: 獲得スコア
 * - カテゴリごとに色分けした散布点 + 全カテゴリ合算の折れ線
 * - モバイル対応 (ResponsiveContainer)
 */
import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScoreRecord } from '@/types/account';

interface ScoreTrendChartProps {
  scores: ScoreRecord[];
  /** 表示件数の上限 (新しい順から N 件、default: 30)。 */
  limit?: number;
}

type SeriesKey = 'basic' | 'regional' | 'expert' | 'photo';

interface ChartPoint {
  /** 表示ラベル (MM/DD HH:mm)。 */
  label: string;
  /** X 軸ソート用の epoch ms。 */
  playedAtMs: number;
  basic?: number;
  regional?: number;
  expert?: number;
  photo?: number;
}

/** カテゴリ / 写真クイズの表示メタ (依頼書の指定色に準拠)。 */
const SERIES_META: Record<SeriesKey, { label: string; color: string }> = {
  basic: { label: '初級', color: '#2563eb' }, // 青
  regional: { label: '中級', color: '#16a34a' }, // 緑
  expert: { label: '上級', color: '#dc2626' }, // 赤
  photo: { label: '写真', color: '#ca8a04' }, // 黄
};

function toSeriesKey(record: ScoreRecord): SeriesKey | null {
  if (record.quizType === 'photo') return 'photo';
  if (record.category === 'basic' || record.category === 'regional' || record.category === 'expert') {
    return record.category;
  }
  return null;
}

function formatLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes(),
    ).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export function ScoreTrendChart({ scores, limit = 30 }: ScoreTrendChartProps): JSX.Element {
  const data = useMemo<ChartPoint[]>(() => {
    // 新しい順に limit 件抽出 → 描画のため古い順に反転
    const sorted = [...scores].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
    const picked = sorted.slice(0, limit).reverse();
    return picked.map((s) => {
      const key = toSeriesKey(s);
      const point: ChartPoint = {
        label: formatLabel(s.playedAt),
        playedAtMs: new Date(s.playedAt).getTime(),
      };
      if (key) {
        point[key] = s.score;
      }
      return point;
    });
  }, [scores, limit]);

  if (data.length === 0) {
    return (
      <p className="text-sm text-ramen-soy/70">
        まだプレイ履歴がありません。クイズに挑戦するとここにスコア推移が表示されます。
      </p>
    );
  }

  const seriesKeys: SeriesKey[] = ['basic', 'regional', 'expert', 'photo'];

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="label"
            fontSize={10}
            tick={{ fill: '#374151' }}
            interval="preserveStartEnd"
          />
          <YAxis fontSize={10} tick={{ fill: '#374151' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 12 }}
            formatter={(value: number, name: string) => {
              // name は seriesKey なのでラベルに置き換える
              const meta = SERIES_META[name as SeriesKey];
              return [value, meta?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value: string) => SERIES_META[value as SeriesKey]?.label ?? value}
          />
          {seriesKeys.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SERIES_META[key].color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              // 値が undefined の点は接続しない
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ScoreTrendChart;
