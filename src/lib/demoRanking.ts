/**
 * ランキングの見え方を整える処理 (集客施策・2026-10)。
 *
 * 1. テスト用アカウント (`testuser` で始まる名前) はどのランキングにも出さない。
 * 2. 本物のユーザーが 5 人に満たないカテゴリは、デモユーザーで 5 位まで埋める。
 *    ランキングは週間 (月曜 0 時リセット) なので、デモの達成日も今週の中に置く。
 *    - デモユーザーは満点 (10 問全問正解) にしない。正解は最大 9 問
 *    - 顔ぶれと点数は毎週月曜 0 時 (日本時間) に入れ替わる。週番号を種にした
 *      擬似乱数で決めるので、同じ週なら誰が見ても同じ表になる (DB・定期実行は不要)
 *    - 本物のユーザーが 5 人以上になったカテゴリでは、デモユーザーは 1 人も出ない
 *
 * デモユーザーは DB には存在せず、表示の直前に混ぜるだけ。
 * 本物のユーザーの get_my_ranking の順位にはデモユーザーは数えない。
 */
import { BASE_POINTS_PER_CORRECT, QUESTIONS_PER_SESSION } from '@/config/quizConfig';
import type { Prefecture } from '@/data/prefectures';
import type { RankingCategory, RankingEntry } from '@/types/account';

/** 本物のユーザーがこの人数に達するまでデモユーザーで埋める。 */
export const DEMO_FILL_COUNT = 5;

const EXCLUDED_USERNAME = /^testuser/i;

/** ランキングに出さないユーザー名か (社長のテスト用アカウント)。 */
export function isExcludedFromRanking(username: string): boolean {
  return EXCLUDED_USERNAME.test(username);
}

const DEMO_ID_PREFIX = 'demo:';

/** デモユーザーの行か (表の下の「参考記録を含みます」の表示判定に使う)。 */
export function isDemoEntry(entry: RankingEntry): boolean {
  return entry.user.id.startsWith(DEMO_ID_PREFIX);
}

interface DemoPersona {
  username: string;
  prefecture: Prefecture;
  favoriteShop: string;
}

// 名前は src/lib/validation.ts の規則 (3〜20 文字・使える文字) に合わせること。
// 同じ名前は常に同じ都道府県・好きな店で出す (週をまたいでも人物像がぶれないように)。
const DEMO_PERSONAS: readonly DemoPersona[] = [
  { username: '麺かためマン', prefecture: '福岡県', favoriteShop: '一蘭' },
  { username: 'tonkotsu_lover', prefecture: '福岡県', favoriteShop: '一風堂' },
  { username: '札幌みそ派', prefecture: '北海道', favoriteShop: 'すみれ' },
  { username: '替え玉マスター', prefecture: '福岡県', favoriteShop: '元祖長浜屋' },
  { username: 'つけ麺部長', prefecture: '東京都', favoriteShop: '六厘舎' },
  { username: 'しょうゆ太郎', prefecture: '東京都', favoriteShop: '春木屋' },
  { username: 'chashu88', prefecture: '神奈川県', favoriteShop: '吉村家' },
  { username: 'ネギ多めで', prefecture: '京都府', favoriteShop: '新福菜館' },
  { username: '背脂チャッチャ', prefecture: '新潟県', favoriteShop: '杭州飯店' },
  { username: 'moyashi_mashi', prefecture: '東京都', favoriteShop: 'ラーメン二郎 三田本店' },
  { username: '喜多方ファン', prefecture: '福島県', favoriteShop: '坂内食堂' },
  { username: 'ramen_walker', prefecture: '埼玉県', favoriteShop: '地元の町中華' },
  { username: '味噌バター', prefecture: '北海道', favoriteShop: '純連' },
  { username: '家系はじめました', prefecture: '神奈川県', favoriteShop: '近所の家系ラーメン' },
  { username: '汁なし派', prefecture: '広島県', favoriteShop: 'きさく' },
  { username: 'nibo_kichi', prefecture: '青森県', favoriteShop: '長尾中華そば' },
  { username: 'あっさり党', prefecture: '東京都', favoriteShop: '中華そば 青葉' },
  { username: 'こってり党', prefecture: '京都府', favoriteShop: '天下一品 総本店' },
  { username: 'zuzuzu_kun', prefecture: '大阪府', favoriteShop: '金久右衛門' },
  { username: 'ラーメン巡り中', prefecture: '千葉県', favoriteShop: '竹岡式の店' },
  { username: 'yuzushio', prefecture: '東京都', favoriteShop: 'AFURI' },
  { username: '鶏白湯ラブ', prefecture: '愛知県', favoriteShop: '近所の鶏白湯の店' },
  { username: 'めんま大盛り', prefecture: '栃木県', favoriteShop: '佐野ラーメンの店' },
  { username: 'noodle_taka', prefecture: '大阪府', favoriteShop: '人類みな麺類' },
  { username: '徳島ラーメン推し', prefecture: '徳島県', favoriteShop: 'いのたに' },
  { username: '旭川しょうゆ', prefecture: '北海道', favoriteShop: '蜂屋' },
  { username: 'kaedama_2', prefecture: '熊本県', favoriteShop: '桂花' },
  { username: '和歌山中華そば', prefecture: '和歌山県', favoriteShop: '井出商店' },
  { username: 'ramen_yuki', prefecture: '宮城県', favoriteShop: '地元のラーメン屋' },
  { username: '辛味噌好き', prefecture: '東京都', favoriteShop: '蒙古タンメン中本' },
  { username: '昼はラーメン', prefecture: '静岡県', favoriteShop: '会社近くの中華そば' },
  { username: 'hakata_boy', prefecture: '福岡県', favoriteShop: 'だるま' },
  { username: '富山ブラック', prefecture: '富山県', favoriteShop: '西町大喜' },
  { username: 'ラ活の人', prefecture: '神奈川県', favoriteShop: '支那そばや' },
  { username: 'shoyu_ken', prefecture: '群馬県', favoriteShop: '地元の食堂' },
  { username: '鹿児島とんこつ', prefecture: '鹿児島県', favoriteShop: 'のぼる屋' },
  { username: '麺ログ係', prefecture: '長野県', favoriteShop: '気になる新店' },
  { username: 'shio_mania', prefecture: '岩手県', favoriteShop: '塩ラーメンの店' },
  { username: '週3ラーメン', prefecture: '大阪府', favoriteShop: '神座' },
  { username: 'ramen_haru', prefecture: '兵庫県', favoriteShop: '地元の老舗' },
];

/** カテゴリごとのデモユーザーの正解数の幅 (最大 9 = 満点にしない)。 */
const CORRECT_RANGE: Record<RankingCategory, readonly [number, number]> = {
  basic: [6, 9],
  regional: [5, 9],
  expert: [4, 8],
  photo: [4, 8],
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 1970-01-01 は木曜。4 日ずらして週の区切りを月曜 0 時にする。
const MONDAY_OFFSET_MS = 4 * DAY_MS;

/** 日本時間の月曜 0 時で区切った週番号。 */
export function jstWeekIndex(nowMs: number): number {
  return Math.floor((nowMs + JST_OFFSET_MS - MONDAY_OFFSET_MS) / WEEK_MS);
}

function weekStartMs(weekIndex: number): number {
  return weekIndex * WEEK_MS + MONDAY_OFFSET_MS - JST_OFFSET_MS;
}

/** 今週 (日本時間の月曜 0 時) の始まりの時刻。週間ランキングの集計期間の起点。 */
export function jstWeekStartMs(nowMs: number): number {
  return weekStartMs(jstWeekIndex(nowMs));
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32。同じ種なら同じ列を返す。 */
function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * その週・カテゴリのデモユーザー (最大 DEMO_FILL_COUNT 人) を作る。
 * 返す順番はランダム (点数順ではない)。足りない人数分だけ先頭から使う。
 */
export function buildDemoEntries(
  category: RankingCategory,
  nowMs: number,
  takenUsernames: ReadonlySet<string> = new Set(),
): RankingEntry[] {
  const week = jstWeekIndex(nowMs);
  const random = createRandom(hashString(`${week}:${category}`));
  const candidates = DEMO_PERSONAS.filter(
    (p) => !takenUsernames.has(p.username.toLowerCase()),
  );
  // Fisher-Yates で並べ替えて先頭から使う
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const [minCorrect, maxCorrect] = CORRECT_RANGE[category];
  // 達成日時は今週の中に散らす。まだ来ていない時刻に当たった人は「少し前」に寄せ、
  // その時刻を過ぎたら本来の日時で固定する (未来の日付を出さず、過ぎた日付は動かさない)
  const weekStart = weekStartMs(week);
  return pool.slice(0, DEMO_FILL_COUNT).map((persona, idx) => {
    const correctCount = randomInt(random, minCorrect, maxCorrect);
    // 時間ボーナスは 1 問 1〜4 点 (最速の 5 点満額は付けない)
    const bonus = randomInt(random, correctCount, correctCount * 4);
    const planned = weekStart + Math.floor(random() * WEEK_MS);
    const latest = Math.max(weekStart, nowMs - (idx + 1) * 17 * 60 * 1000);
    const achievedAt = new Date(Math.min(planned, latest)).toISOString();
    return {
      user: {
        id: `${DEMO_ID_PREFIX}${category}:${persona.username}`,
        username: persona.username,
        prefecture: persona.prefecture,
        favoriteShop: persona.favoriteShop,
        createdAt: achievedAt,
      },
      rankingCategory: category,
      bestScore: correctCount * BASE_POINTS_PER_CORRECT + bonus,
      correctCount,
      totalCount: QUESTIONS_PER_SESSION,
      achievedAt,
    };
  });
}

function compareEntries(a: RankingEntry, b: RankingEntry): number {
  if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
  return a.achievedAt.localeCompare(b.achievedAt);
}

/**
 * DB から取ったランキングにテスト用アカウントの除外とデモユーザーの補充を行う。
 * 本物のユーザーが DEMO_FILL_COUNT 人以上いればデモユーザーは混ぜない。
 */
export function applyRankingPresentation(
  category: RankingCategory,
  entries: readonly RankingEntry[],
  limit: number,
  nowMs: number = Date.now(),
): RankingEntry[] {
  const real = entries.filter((e) => !isExcludedFromRanking(e.user.username));
  const missing = DEMO_FILL_COUNT - real.length;
  if (missing <= 0) return real.slice(0, limit);

  const taken = new Set(real.map((e) => e.user.username.toLowerCase()));
  const demos = buildDemoEntries(category, nowMs, taken).slice(0, missing);
  return [...real, ...demos].sort(compareEntries).slice(0, limit);
}
