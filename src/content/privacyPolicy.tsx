/**
 * プライバシーポリシー本文 (JSX で構造化)。
 *
 * 内容を Privacy ページ (`/privacy`) から表示する。
 * 文章の更新はこのファイルだけを編集すれば反映される設計。
 *
 * 法的記載のため、以下の事項を必ず明記する:
 * - 取得する情報 / 取得しない情報
 * - 第三者提供 (Supabase / Google AdSense / Vercel)
 * - 投稿コンテンツの著作権の扱い
 * - 削除依頼の方法・準拠法
 */
import { LEGAL_LAST_UPDATED, OPERATOR_CONTACT, OPERATOR_NAME } from './legalMeta';

export function PrivacyPolicyContent(): JSX.Element {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-ramen-soy/90">
      <p>
        本ポリシーは、ラーメンクイズ（以下「本サービス」）における個人情報および利用者データの取扱いを定めるものです。
        本サービスをご利用いただく前に、必ずお読みください。
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">1. サービス概要と運営者</h2>
        <p>
          本サービスはラーメンに関するクイズおよびユーザー投稿型の写真クイズを提供する Web アプリケーションです。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <span className="font-bold">運営者:</span> {OPERATOR_NAME}（個人運営）
          </li>
          <li>
            <span className="font-bold">連絡先:</span> {OPERATOR_CONTACT}
            （お問い合わせフォーム <code className="rounded bg-ramen-broth/20 px-1">/contact</code> もご利用いただけます）
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">2. 取得する情報</h2>
        <p>本サービスは以下の情報を取得します。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <span className="font-bold">アカウント登録情報:</span>{' '}
            ユーザー名、都道府県、好きなラーメン店。これらは Supabase 上に保管され、
            <span className="font-bold">ランキング画面で他の利用者に公開されます</span>。
            パスワードは認証基盤（Supabase Auth）がハッシュ化して保管し、本サービスが平文で保持・閲覧することはありません。
            パスワード再設定用の復旧コードも同様にハッシュ化して保管し、平文は登録時に一度表示するのみで保存しません。
          </li>
          <li>
            <span className="font-bold">アカウント作成時の内部識別子:</span>{' '}
            認証基盤の仕様上メールアドレス欄が必須のため、ユーザー名から生成した
            <span className="font-bold">実在しないダミーのアドレス</span>
            （<code className="rounded bg-ramen-broth/20 px-1">&lt;英数字&gt;@example.com</code>）を内部的に使用します。
            利用者の実在するメールアドレスは取得せず、本サービスからメールを送信することもありません。
          </li>
          <li>
            <span className="font-bold">ブラウザ内に保存される情報（localStorage）:</span>{' '}
            ログイン状態を保持するためのセッション情報、お気に入りに登録した問題、間違えた問題の記録、
            アプリのインストール案内を閉じたかどうかの状態。
            このうちお気に入り・間違えた問題・案内の表示状態はご利用端末内のみで管理し、サーバーには送信しません
            （セッション情報は、ログイン中であることを確認するため通信のたびに認証基盤へ送信されます）。
            いずれもブラウザのデータを消去すると失われます。
          </li>
          <li>
            <span className="font-bold">写真クイズ投稿時の入力情報:</span>{' '}
            投稿者本人が任意で記入する店舗情報（店名、エリア、解説など）、画像ファイル、選択した分類タグ。
            これらは Supabase Database / Storage に保管されます。
            なお投稿フォームで「出題時に作成者としてユーザー名を表示する」を選択した場合に限り、
            その問題の出題画面にユーザー名が公開されます。既定では表示しません。
          </li>
          <li>
            <span className="font-bold">スコア記録:</span>{' '}
            クイズの得点・正答数。ランキング表示のためアプリ内ストレージおよび Supabase 上に保存します。
          </li>
          <li>
            <span className="font-bold">アクセスログ:</span>{' '}
            アクセス元 IP、リクエスト URL、ユーザーエージェントなど、ホスティング事業者である Vercel が自動的に収集する一般的なアクセスログ。
          </li>
          <li>
            <span className="font-bold">写真投稿時の自動判定用データ:</span>{' '}
            写真クイズ投稿時に、投稿画像 (Web ブラウザ側で長辺 800px の WebP に最適化・EXIF 削除済み) を
            不適切コンテンツ自動判定のため Google Cloud Vision API に一時的に送信します。
            送信対象は画像バイナリのみで、投稿者のユーザー名・IP アドレス等の付随情報は送りません。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">3. 取得しない情報</h2>
        <p>本サービスは以下の情報を意図的に取得しません。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            メールアドレス。アカウント登録時にも取得しません（2. のとおり、実在しないダミーのアドレスを内部的に生成して使用します）。
            お問い合わせフォームで返信先として任意にご入力いただいた場合のみ取得します。
          </li>
          <li>実名、電話番号、住所などの個人を特定する情報</li>
          <li>投稿された画像の EXIF 情報（位置情報を含む）はアップロード前にブラウザ内で自動削除します</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">4. 第三者提供・委託</h2>
        <p>本サービスは以下の外部サービスを利用しており、利用に伴ってデータが当該サービスに保管されます。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <span className="font-bold">Supabase, Inc.（米国）:</span>{' '}
            データベース・画像ストレージおよびアカウント認証（Supabase Auth）に利用しています。データ保管リージョンは{' '}
            <code className="rounded bg-ramen-broth/20 px-1">ap-northeast-1</code>（東京）を指定しています。
          </li>
          <li>
            <span className="font-bold">Vercel Inc.（米国）:</span>{' '}
            本サービスのホスティングおよび配信に利用しています。アクセスログを自動収集します。
          </li>
          <li>
            <span className="font-bold">Google LLC — Cloud Vision API（米国）:</span>{' '}
            写真クイズ投稿時に、不適切コンテンツ (成人向け・暴力的表現・過激な内容) の自動判定のため、
            投稿画像を Google Cloud Vision SafeSearch API に送信します。
            送信された画像は判定処理のためにのみ使用され、
            Google の
            <a
              href="https://cloud.google.com/vision/docs/data-usage"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 font-bold text-ramen-chili hover:underline"
            >
              データ利用ポリシー
            </a>
            に基づき、モデル学習には利用されません。
            画像は判定完了後、Google 側の一時ログを除き保存されません。
          </li>
          <li>
            <span className="font-bold">Google AdSense（将来導入予定）:</span>{' '}
            広告配信のため Cookie を用いた行動ターゲティング広告を将来的に利用する予定です。導入後は本ポリシーを更新します。
          </li>
          <li>
            <span className="font-bold">アフィリエイトプロバイダ:</span>{' '}
            本サービスは以下のアフィリエイトサービスを通じて提携広告（アフィリエイトリンク）を掲載する場合があります。
            これらのサービスは Cookie やトラッキング技術により、リンク経由の遷移・成果計測等を行います。
            <ul className="ml-5 mt-1 list-[circle] space-y-0.5">
              <li>楽天アフィリエイト（楽天グループ株式会社）</li>
              <li>A8.net（株式会社ファンコミュニケーションズ）</li>
              <li>もしもアフィリエイト（株式会社もしも）</li>
              <li>Amazon アソシエイト・プログラム（Amazon.com, Inc. および関連会社）</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">5. Cookie・広告</h2>
        <p>
          本サービスは将来的に Google AdSense による広告配信を行う予定です。
          AdSense は Cookie や類似技術を利用し、利用者の興味関心に基づいた広告（パーソナライズ広告）を表示します。
          パーソナライズ広告は、Google の{' '}
          <a
            href="https://adssettings.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-ramen-chili hover:underline"
          >
            広告設定
          </a>
          ページからいつでも無効化できます。
        </p>
        <p>
          また、本サービスは上記アフィリエイトプロバイダ（楽天アフィリエイト・A8.net・もしもアフィリエイト・Amazon アソシエイト）の
          リンクを掲載する場合があり、これらの事業者の Cookie やトラッキング技術が使用される可能性があります。
          アフィリエイトリンクには景品表示法（ステルスマーケティング規制）に基づき
          <span className="font-bold">「PR」「広告」「提携リンク」</span>等の表記を必ず付与し、
          利用者が広告であることを明確に認識できるようにしています。
          なお、当サービスは Amazon.co.jp を宣伝しリンクすることによってサイトが紹介料を獲得できる手段を提供することを目的に設定された
          アフィリエイトプログラムである、Amazon アソシエイト・プログラムの参加者です。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">6. ユーザー投稿コンテンツの取扱い</h2>
        <p>
          写真クイズに投稿された画像・店名・解説文の著作権は、投稿者本人に帰属します。
          投稿者は本サービスでの表示・配信・サービス改善のための分析に必要な範囲で、無償・非独占で利用許諾を行うものとします。
        </p>
        <p>
          本サービスは、利用規約に違反すると判断した投稿（他人の著作物の無断投稿、個人情報の写り込み、公序良俗違反等）について、
          事前の通知なく非表示・削除を行うことがあります。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">7. データの削除依頼</h2>
        <p>
          ご自身が投稿された写真クイズの削除をご希望の場合、または不適切なコンテンツの削除をご要望の場合は、
          お問い合わせフォーム（種別「著作権・削除依頼」）または各写真クイズ右下の「この問題を通報」ボタンからご連絡ください。
          内容を確認のうえ、合理的な期間内に対応します。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">8. 改訂</h2>
        <p>
          本ポリシーは法令の変更や本サービスの提供内容に応じて改訂することがあります。
          重要な変更がある場合は、本ページにてお知らせします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">9. 準拠法</h2>
        <p>本ポリシーは日本法に準拠して解釈されます。</p>
      </section>

      <p className="border-t border-ramen-soy/10 pt-4 text-xs text-ramen-soy/60">
        最終更新日: {LEGAL_LAST_UPDATED}
      </p>
    </div>
  );
}
