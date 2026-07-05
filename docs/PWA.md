# PWA 対応

ラーメンクイズを PWA (Progressive Web App) 化し、以下を実現しています。

## 提供機能

1. **ホーム画面追加**: スマホ / デスクトップにアプリとしてインストール可能
2. **オフラインプレイ**: 知識クイズ・お気に入り・復習は通信断でも動作
3. **フルスクリーン表示**: インストール後はブラウザ UI 無しで起動
4. **アップデート自動反映**: Service Worker が背景で新版を取得、次回リロード時に反映
5. **オフライン通知**: 通信断時はページ上部に赤帯で明示

## 技術スタック

- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) v1.x
- [Workbox](https://developer.chrome.com/docs/workbox) (vite-plugin-pwa が内包)

## ファイル一覧

| ファイル | 役割 |
|---|---|
| `vite.config.ts` | `VitePWA()` プラグイン設定 (manifest + runtime cache) |
| `public/pwa-icon.svg` | 通常アイコン (192/512 相当、SVG 拡大縮小) |
| `public/pwa-icon-maskable.svg` | Android アダプティブアイコン用 (中央 40% がセーフエリア) |
| `index.html` | `<link rel="manifest">` / theme-color / apple-touch-icon |
| `src/components/common/InstallPrompt.tsx` | 「ホーム画面に追加」バナー |
| `src/components/common/OfflineIndicator.tsx` | オフライン通知帯 |

## キャッシュ戦略

| リソース | ハンドラー | 理由 |
|---|---|---|
| `index.html` (Navigation) | `NetworkFirst` + fallback | 新版を優先。オフライン時は SW キャッシュから提供 |
| JS / CSS / SVG / フォント (build 済み) | プレキャッシュ | ハッシュ付きファイル名なので長期キャッシュ安全 |
| Google Fonts (CSS) | `StaleWhileRevalidate` | 速度優先、背景更新 |
| Google Fonts (woff2) | `CacheFirst` (1 年) | 変わらないため長期キャッシュ |
| Supabase Storage 画像 | `CacheFirst` (30 日) | 写真クイズ画像。頻繁には更新されない |
| Supabase Auth / REST | `NetworkOnly` | セッション・スコアはリアルタイム必須 |

## オフライン時の挙動

**動作する機能**
- 知識クイズ (150 問すべて、`questions.json` はバンドル同梱)
- お気に入り (localStorage)
- 間違えた問題の復習 (localStorage)
- 学習モード (`/learn`)
- Home / About / Privacy / Terms / FAQ / Glossary / Regions (静的ページ)

**動作しない機能** (`OfflineIndicator` で明示)
- ランキング (Supabase 依存)
- 写真クイズ (画像 URL の初回取得は要通信、キャッシュされていれば OK)
- 写真クイズ投稿 (Supabase Storage への PUT)
- サインアップ / ログイン (Supabase Auth 要通信)
- お問い合わせ / 通報 (Supabase INSERT)

## 動作確認

### デスクトップ Chrome / Edge
1. `npm run build` → `npm run preview` (HTTPS 相当のローカルサーバ)
2. アドレスバー右側に「インストール」アイコンが表示される
3. クリック → ホーム画面 / スタートメニューにアプリが追加される
4. アプリを起動するとブラウザ UI 無しで開く
5. DevTools → Application → Manifest / Service Workers / Storage で動作確認

### Android Chrome
1. サイトを開いて 30 秒以上滞在
2. `beforeinstallprompt` イベントが発火し、独自バナー (下部) が表示される
3. 「追加」タップ → OS のインストールダイアログ → ホーム画面追加

### iOS Safari
1. Safari で開く
2. 共有ボタン → 「ホーム画面に追加」を選択
3. iOS Safari は `beforeinstallprompt` を発火しないため、独自バナーは出ない
4. インストール後は `apple-mobile-web-app-capable` によりフルスクリーン起動

### オフライン検証
1. インストール後、通信を切る (DevTools → Network → Offline / 機内モード)
2. Home / 知識クイズ / Learn が引き続き開ける
3. ページ上部に赤帯「オフラインです」が表示される
4. `/ranking` を開くと Supabase 取得失敗のエラーが出る (想定通り)

## Lighthouse スコア

PWA 対応後の Lighthouse (Chrome DevTools → Lighthouse) で以下を確認:

- **Installable**: ✅ (manifest + SW 登録済み)
- **PWA Optimized**: ✅ (theme-color / viewport / apple-touch-icon)
- **Performance**: PWA 化前と大差なし (SW 初回登録の 30ms 追加程度)

## 更新フロー

コード変更後:
1. `git push` → Vercel が新バージョンをデプロイ
2. 既にアプリをインストール済みのユーザーは、次回アクセス時に SW が背景で更新を検知
3. `registerType: 'autoUpdate'` により、次のリロードで自動的に新版が適用される
4. ユーザーに更新通知を出したい場合は `virtual:pwa-register` の `onNeedRefresh` フックを使う (現状は未実装)

## 既知の制約

- **SVG アイコン**: 一部の古い Android / iOS ではアイコンが正しく表示されない場合あり
  → 将来的に PNG 版 (192 / 512 / maskable) を追加すると完全対応
- **Web Share API**: iOS Safari の共有経由の Add to Home Screen は独自バナー対象外
- **キャッシュサイズ**: モバイル OS が容量圧迫時に SW キャッシュを破棄することがある
- **開発モード無効**: `devOptions.enabled: false` にしているので `npm run dev` では PWA
  として動かない。動作確認は `npm run build && npm run preview` で行う。

## 変更履歴

- 2026-07-05: Phase 3 で PWA 対応初版を導入
