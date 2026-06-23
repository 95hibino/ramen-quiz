/**
 * 利用規約本文 (JSX で構造化)。
 *
 * 内容を Terms ページ (`/terms`) から表示する。
 * 文章の更新はこのファイルだけを編集すれば反映される設計。
 *
 * 法的記載のため、以下の事項を必ず明記する:
 * - サービス目的
 * - 簡易アカウントの利用条件
 * - 禁止事項
 * - 投稿コンテンツのライセンス
 * - 免責事項・サービス停止
 * - 準拠法・裁判管轄
 */
import { LEGAL_LAST_UPDATED, OPERATOR_NAME } from './legalMeta';

export function TermsOfServiceContent(): JSX.Element {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-ramen-soy/90">
      <p>
        本利用規約（以下「本規約」）は、{OPERATOR_NAME}（個人運営。以下「当方」）が提供するラーメンクイズ（以下「本サービス」）の利用条件を定めるものです。
        本サービスをご利用いただいた時点で、本規約に同意したものとみなします。
      </p>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">1. サービスの目的</h2>
        <p>
          本サービスは、ラーメンに関する知識・歴史・地域文化・店舗写真などを題材とした 4 択クイズを提供し、
          ラーメン文化への理解を楽しみながら深めていただくことを目的としています。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">2. 簡易アカウントの利用条件</h2>
        <p>
          本サービスは、ユーザー名とパスワードのみによる簡易アカウントを採用しています。
          メールアドレスや実名等の個人情報は登録不要です。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>パスワードは送信前に SHA-256 でハッシュ化したうえで、ご利用ブラウザの localStorage に保存されます。</li>
          <li>
            アカウントはブラウザの localStorage に紐付くため、別端末・別ブラウザではご利用いただけません。
            ブラウザのデータを削除するとアカウント情報も失われます。
          </li>
          <li>パスワードを忘れた場合の復旧手段はありません。同じユーザー名で再登録することは可能です。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">3. 禁止事項</h2>
        <p>本サービスの利用にあたり、利用者は以下の行為を行ってはなりません。</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>他人の著作物（画像、店舗名以外の解説文、その他のテキスト等）を権利者の許諾なく投稿する行為</li>
          <li>個人を特定できる人物が写った画像（他のお客様や店員の顔がはっきり写っているものなど）を投稿する行為</li>
          <li>公序良俗に反する画像、暴力的・性的・差別的な内容を投稿する行為</li>
          <li>自動投稿ツール、スクレイピング、その他の手段で本サービスへ過度な負荷をかける行為</li>
          <li>他の利用者への誹謗中傷、嫌がらせ、その他の迷惑行為</li>
          <li>レート制限を回避することを目的とした複数アカウントの作成・運用</li>
          <li>
            管理者用ユーザー名（<code className="rounded bg-ramen-broth/20 px-1">_shacho</code>）
            その他、運営者になりすます目的での詐称行為
          </li>
          <li>本サービスの提供を妨害する行為、または法令に違反する行為</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">4. 投稿コンテンツのライセンス</h2>
        <p>
          利用者は、本サービスに投稿した画像・テキスト等のコンテンツについて、自らが正当な権利を有していること、
          または権利者から必要な許諾を得ていることを保証します。
        </p>
        <p>
          投稿コンテンツの著作権は投稿者本人に帰属しますが、利用者は当方に対し、
          本サービスでの表示・配信・サービス品質改善のための分析・統計利用に必要な範囲で、
          無償・非独占的・サブライセンス可能な利用許諾を行うものとします。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">5. サービスの停止・変更・終了</h2>
        <p>
          当方は、利用者への事前の通知なく、本サービスの内容を変更し、または提供を一時停止・終了することがあります。
          これによって利用者または第三者に生じた損害について、当方は一切の責任を負いません。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">6. 免責事項</h2>
        <ul className="ml-5 list-disc space-y-1">
          <li>本サービスで提供されるクイズの設問・選択肢・解説の内容について、当方は正答性・最新性を保証しません。</li>
          <li>
            ユーザー投稿型の写真クイズに含まれる店舗情報（店名、エリア、解説等）の正確性は投稿者の責任に帰属し、
            当方は内容の真偽について保証するものではありません。
          </li>
          <li>
            本サービスを利用したことにより利用者に生じた一切の損害について、
            当方の故意または重過失による場合を除き、当方は責任を負いません。
          </li>
          <li>
            本サービスは Supabase / Vercel 等の外部サービスを利用しています。
            これらの外部サービスに起因する障害・データ損失について、当方は責任を負いません。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">7. 規約の改定</h2>
        <p>
          当方は、必要に応じて本規約を改定することがあります。
          重要な変更がある場合は、本ページにてお知らせします。改定後の規約は、本サービスへの掲載をもって効力を生じます。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold text-ramen-soy">8. 準拠法・裁判管轄</h2>
        <p>
          本規約の解釈および適用は、日本法に準拠します。
          本サービスに関連して当方と利用者との間に紛争が生じた場合は、運営者の住所地を管轄する地方裁判所を専属的合意管轄裁判所とします。
        </p>
      </section>

      <p className="border-t border-ramen-soy/10 pt-4 text-xs text-ramen-soy/60">
        最終更新日: {LEGAL_LAST_UPDATED}
      </p>
    </div>
  );
}
