# Vercel Analytics 運用ガイド

`@vercel/analytics` を導入済み（`src/App.tsx` の `<Analytics />`）。
Vercel Dashboard から PV・訪問者数・パス別トラフィック・Web Vitals を確認できる。

## 初回セットアップ（1 分）

1. Vercel Dashboard → Project → **Analytics** タブ
2. **"Enable Analytics"** ボタンをクリック
3. 無料プランで有効化完了（Hobby プラン: 2,500 events/日まで）
4. 数分〜数時間でデータが表示され始める

## アクセス方法

- Web: Vercel Dashboard → Project → Analytics
- 見られる期間: 直近 24h / 7d / 30d / 90d を切り替え可能
- フィルタ: パス別・国別・デバイス別・OS別・ブラウザ別

## 主要指標の意味

### Visitors（訪問者数）

同一日に何回来ても 1 とカウントされるユニークユーザー。
**サイトの実質規模を測る一番大事な指標**。

- 目安（個人サービスの場合）:
  - 初期: 数十〜数百/日
  - 軌道乗った: 数百〜数千/日
  - バズ: 数千〜万/日

### Page Views（ページビュー）

1 訪問中に見たページ数の合計。`Visitors × 平均ページ数`。

**Page Views / Visitors の比率**:
- 1.0 前後: 直帰率が高い（TOP だけ見て離脱）
- 2.0-3.0: 平均的なクイズサイト
- 3.0+: 回遊できている（複数カテゴリを試している）

### Bounce Rate（直帰率）

TOP を見てすぐ帰った率。低いほど良い。
- 30% 未満: 素晴らしい
- 30-60%: 標準
- 60% 以上: TOP の訴求が弱い or ロード遅い

### Top Pages（人気ページ）

パス別の PV ランキング。ここで気づくこと:

- `/quiz/knowledge/basic` が多いのに `/quiz/knowledge/regional` が少ない → 難易度で離脱している可能性
- `/regions/tokyo` みたいな SEO ページが上位 → 検索流入が効いている
- `/quiz/photo/submit` が想定外に多い → 投稿意欲のあるユーザーが多い

### Top Referrers（流入元）

どこから来たかのランキング。
- **direct** = URL 直打ち or ブックマーク（リピーター指標）
- **google** = 検索流入（SEO の効果）
- **x.com** / **twitter** = X 経由シェア
- **line** = LINE でシェアされた
- **(none)** = 不明（アプリ内リンク遷移など）

### Top Countries / Devices / OS

日本以外からのアクセスがあれば海外向けの動線検討余地。
Mobile > Desktop が普通（スマホ主戦場）。

## Web Vitals（品質指標）

Analytics タブ内 **"Speed Insights"** サブタブ（無料枠に含まれる）:

| 指標 | 意味 | 良い値 |
|---|---|---|
| **LCP** (Largest Contentful Paint) | 最大要素の描画時間 | < 2.5 秒 |
| **INP** (Interaction to Next Paint) | クリック応答性 | < 200 ms |
| **CLS** (Cumulative Layout Shift) | レイアウトのがたつき | < 0.1 |
| **FCP** (First Contentful Paint) | 初回描画時間 | < 1.8 秒 |
| **TTFB** (Time to First Byte) | サーバー応答速度 | < 800 ms |

Google の Core Web Vitals は SEO 順位に影響するので、いずれかが赤字（Poor）になったら要対処。

## 改善のトリガー

以下のパターンが見えたら次のアクションを検討:

| パターン | 対処 |
|---|---|
| 直帰率 > 60% | TOP のフックを見直し、ファーストビューでクイズを始めやすくする |
| 検索流入がゼロに近い | Google Search Console でインデックス状況確認、コンテンツ増強 |
| 特定パスで CLS > 0.1 | 広告枠のサイズ固定、画像に width/height 属性を明示 |
| モバイルの Bounce > デスクトップ | モバイル UI の改善 (タップ範囲、フォントサイズ) |
| 特定国から異常アクセス | ボット可能性、Cloudflare 等で地域ブロック検討 |
| Page Views / Visitors 比が 1.0 | 内部リンク不足。関連クイズへの導線を強化 |

## 制限事項（無料プランの場合）

- **Hobby プラン**: 2,500 events/日 まで（1 訪問者 ≈ 数 events）
  - 100 訪問者/日 なら十分収まる
  - 1,000 訪問者/日 になったら Pro プラン（$20/月）検討
- データ保持: 直近 30 日（Hobby）/ 3 ヶ月（Pro）
- カスタムイベント: Hobby では不可、Pro のみ

## 他ツールとの使い分け

| ツール | 得意 | 弱点 |
|---|---|---|
| **Vercel Analytics** | セットアップ簡単、Cookie 不要、Web Vitals 同時計測 | イベント制限、詳細分析なし |
| **Google Analytics 4** | 詳細な流入分析、コンバージョン計測 | Cookie 必要、プライバシーポリシー更新必須、UI 複雑 |
| **Google Search Console** | 検索順位・検索クエリ・インデックス状況 | ユーザー行動は分からない |
| **Sentry** | エラー・パフォーマンス問題の検知 | トラフィック分析には使えない |

**現状の推奨**: Vercel Analytics + GSC + Sentry の 3 点セット。GA4 は必要になったら追加。

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| データが 0 のまま | Analytics タブで "Enable Analytics" を押していない |
| 「Not enough data」表示 | 24 時間程度データが必要 |
| Web Vitals が Insufficient Data | ユーザー数が少ないと計測に必要なサンプルが集まらない。100 訪問者/日 程度必要 |
| 広告ブロッカー使用者が計測から漏れる | 仕様。実数は表示値の 1.2〜1.5 倍程度が実態 |

## コード配置

| ファイル | 役割 |
|---|---|
| `package.json` | `@vercel/analytics` パッケージ依存 |
| `src/App.tsx` | `<Analytics />` を最下部にマウント |
