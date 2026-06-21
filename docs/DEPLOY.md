# 本番デプロイガイド (Vercel)

ラーメンクイズを Vercel に本番公開するための手順です。

## 背景

LifePlanning リポジトリは公開禁止のため、本アプリディレクトリ
(`shacho/engineering/output/ramen_quiz/`) を **別の公開リポジトリに切り出して**
Vercel と連携させます。ボイラー技士アプリ (`legal_site`) と同じ運用方針です。

---

## 全体の流れ

```
A. 公開用 GitHub リポジトリを作成
B. ramen_quiz/ を新フォルダにコピーして git init
C. Vercel でプロジェクトを作成 (GitHub 連携)
D. Vercel 環境変数を設定
E. (任意) カスタムドメイン設定
F. 以後の同期運用フロー
```

---

## A. 公開用 GitHub リポジトリ作成

1. <https://github.com/new> で新規リポジトリを作成
   - 推奨名: `ramen-quiz`
   - **Public 推奨**: AdSense 審査やシェアの観点で公開リポジトリの方が透明性が高い。
     ただしソースを完全に隠したいなら Private でも OK (Vercel との連携は同じ)
   - Initialize は **すべて OFF** (README / .gitignore / license を Vercel 側で作らない)

2. 作成後、表示される SSH or HTTPS URL を控える
   - 例: `git@github.com:95hibino/ramen-quiz.git`

---

## B. ramen_quiz/ を別フォルダにコピー → git init → push

Windows + PowerShell 想定。Bash/WSL を使う場合は適宜読み替えてください。

### 1. ディレクトリを丸ごとコピー

```powershell
# 切り出し先 (例: C:\Users\hibino\CC\ramen-quiz-publish\)
$src  = 'C:\Users\hibino\CC\LifePlanning\shacho\engineering\output\ramen_quiz'
$dest = 'C:\Users\hibino\CC\ramen-quiz-publish'

# 既存があれば消す (一度きりの初回作業のみ)
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }

# robocopy で除外しつつコピー
robocopy $src $dest /MIR /XD node_modules dist .vite .turbo .vercel /XF .env .env.local .env.*.local *.tsbuildinfo
```

### 2. コピー後の安全チェック (重要)

```powershell
cd $dest

# .env.local が混入していないか確認
Get-ChildItem -Force -Recurse -Filter '.env*' | Select-Object FullName

# 機密が含まれそうなファイルがないか確認
Get-ChildItem -Force | Where-Object { $_.Name -like '.env*' -and $_.Name -ne '.env.example' }
```

`.env.example` 以外の `.env*` が出てこなければ OK。

### 3. git 初期化 & 初回コミット

```powershell
cd $dest
git init
git add .
git status   # コミット対象を最終確認
git commit -m "Initial commit: ラーメンクイズ初版"
```

### 4. リモート設定 & push

```powershell
git remote add origin git@github.com:95hibino/ramen-quiz.git
git branch -M main
git push -u origin main
```

---

## C. Vercel プロジェクト作成

1. <https://vercel.com/> にログイン (GitHub アカウント連携)
2. **Add New... → Project** → GitHub の `ramen-quiz` リポジトリを **Import**
3. Framework Preset は **Vite** が自動検出されるはず
4. Build / Output 設定は `vercel.json` に書いてあるので **そのまま Deploy**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install` (デフォルト)
5. 初回デプロイが走り、`https://ramen-quiz-xxx.vercel.app/` で確認できる

---

## D. Vercel 環境変数を設定

`.env.example` のキーを Vercel Dashboard 側にも登録します。

1. プロジェクト → **Settings → Environment Variables**
2. 以下を順に追加:

| Key                              | Value                              | Environment                       |
| -------------------------------- | ---------------------------------- | --------------------------------- |
| `VITE_SUPABASE_URL`              | `.env.local` の値                  | Production, Preview, Development  |
| `VITE_SUPABASE_ANON_KEY`         | `.env.local` の値                  | Production, Preview, Development  |
| `VITE_SITE_URL`                  | 本番ドメイン (例 `https://ramen-quiz.example.com`) | Production                        |
| `VITE_OPERATOR_NAME`             | 運営者名                           | Production, Preview, Development  |
| `VITE_OPERATOR_CONTACT`          | 連絡先メール                       | Production, Preview, Development  |
| `VITE_ADSENSE_CLIENT_ID`         | `ca-pub-xxxxxxxxxxxxxxxx` (審査通過後) | Production                        |
| `VITE_ADSENSE_SLOT_HOME_TOP`     | スロット ID                        | Production                        |
| `VITE_ADSENSE_SLOT_KNOWLEDGE_TOP`| スロット ID                        | Production                        |
| `VITE_ADSENSE_SLOT_RESULT`       | スロット ID                        | Production                        |
| `VITE_ADSENSE_SLOT_FOOTER`       | スロット ID                        | Production                        |
| `VITE_ADSENSE_SLOT_IN_FEED`      | スロット ID                        | Production                        |

3. 保存後、**Deployments → 最新コミットの ... → Redeploy** で再ビルド
   （Vite ビルド時に値が埋め込まれるため再デプロイ必須）

---

## E. (任意) カスタムドメイン設定

1. プロジェクト → **Settings → Domains** → ドメインを追加
2. ドメイン管理画面 (Cloudflare / お名前.com 等) で表示された DNS レコードを設定
   - apex の場合: A レコード
   - sub の場合: CNAME レコード
3. 反映後、Vercel が自動で SSL 証明書を発行

---

## F. 同期運用フロー

LifePlanning 側で機能追加した後、公開リポジトリへ反映する流れ。

### 方式 1: 手動コピー (推奨・初期)

```powershell
# 1. LifePlanning 側で変更をコミット
cd C:\Users\hibino\CC\LifePlanning
git add ...
git commit -m "..."

# 2. 公開先に robocopy で同期 (上記 B-1 と同じコマンド)
$src  = 'C:\Users\hibino\CC\LifePlanning\shacho\engineering\output\ramen_quiz'
$dest = 'C:\Users\hibino\CC\ramen-quiz-publish'
robocopy $src $dest /MIR /XD node_modules dist .vite .turbo .vercel .git /XF .env .env.local .env.*.local *.tsbuildinfo

# 3. 公開先でコミット & push
cd $dest
git add .
git diff --cached --stat   # 差分確認
git commit -m "sync: <変更内容の要約>"
git push
```

> **重要**: 上記の `/XD .git` がないと、コピー先の `.git/` が **コピー元の空状態に上書きされて履歴消失** する。必ず除外すること。

### 方式 2: スクリプト化 (運用が安定したら)

`shacho/engineering/output/ramen_quiz/scripts/sync-to-publish.ps1` を用意して
1 コマンドで同期できるようにする運用案。初期はコピーミスを目視で防ぐため方式 1 推奨。

---

## G. 既存運用との比較 (legal_site)

ボイラー技士アプリ (Flutter) は `legal_site` リポジトリに切り出して **GitHub Pages** で公開している実績があります。
ラーメンクイズは Web アプリ (Vite + SPA) のため Vercel が最適です。

| 項目                | legal_site (ボイラー技士)    | ramen-quiz (新規)            |
| ------------------- | ---------------------------- | ---------------------------- |
| 公開先              | GitHub Pages                 | Vercel                       |
| ビルド              | Flutter Web                  | Vite                         |
| SPA リライト        | GH Pages 用 `404.html` 工夫  | `vercel.json` の `rewrites`  |
| 環境変数            | ビルド時引数 (`--dart-define`) | Vercel Environment Variables |
| カスタムドメイン    | GH Pages 設定                | Vercel Domains               |
| 自動デプロイ        | GH Actions or `peaceiris/actions-gh-pages` | GitHub 連携で push 時自動 |

---

## トラブルシューティング

| 症状                                    | 確認事項                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------- |
| ビルドエラー `tsc -b` 失敗              | `npm run lint` をローカルで実行して再現 / 型エラーを解消                    |
| デプロイ後 404 (ルート以外のページ)     | `vercel.json` の `rewrites` が反映されているか / 設定変更後に再デプロイしたか |
| 環境変数が反映されない                  | Vite はビルド時に値を埋め込むため、設定変更後は必ず Redeploy                 |
| `/ads.txt` が SPA リライトに巻き込まれる | `vercel.json` の rewrites パターンに ads.txt 除外が含まれているか確認        |
| 写真投稿が動かない                      | Supabase 環境変数が Production にも設定されているか / RLS ポリシー         |

---

## 関連ドキュメント

- `docs/SUPABASE_SETUP.md` — Supabase の設定 (DB / Storage / RLS)
- `docs/ADSENSE_SETUP.md` — AdSense の設定 (アカウント / 広告ユニット / ads.txt)
- `.env.example` — 環境変数の雛形
- `vercel.json` — Vercel ビルド & ヘッダ設定
