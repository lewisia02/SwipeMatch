import Link from 'next/link';
import { ColorBar } from '@/components/ColorBar';

function Shot({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={caption}
        width={375}
        height={812}
        className="w-40 rounded-lg border border-ink/10 shadow-sm"
      />
      <figcaption className="text-caption text-text-muted">{caption}</figcaption>
    </figure>
  );
}

export default function HowToUsePage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-10 p-6">
      <div className="flex flex-col gap-3">
        <Link href="/" className="text-caption text-text-muted">
          ← トップへ戻る
        </Link>
        <p className="font-mono text-caption uppercase tracking-widest text-text-muted">
          参加者ガイド
        </p>
        <h1 className="font-display text-h1 leading-tight">使い方ガイド</h1>
        <ColorBar className="h-1.5 w-24 rounded-full" />
        <p className="text-body text-text-muted">
          SwipeMatchはログイン不要、QRコードを読み取るだけで参加できます。投稿からランオフ投票までの流れを、実際の画面とあわせて説明します。
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 1: 名前を入力してはじめる</h2>
        <p className="text-body">
          QRコードを読み取る、またはURLにアクセスすると、最初にこの画面が表示されます。
        </p>
        <ul className="list-disc pl-5 text-body">
          <li>入力した名前は、ロゴを投稿したときの投稿者名として使われます</li>
          <li>本名でなくても構いません</li>
          <li>一度入力すれば、同じスマートフォンで使い続ける限り再入力は不要です</li>
        </ul>
        <Shot src="/how-to-use/00-namegate.png" caption="名前入力ゲート" />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 2: ロゴ画像を投稿する</h2>
        <p className="text-body">
          投稿受付中は、トップ画面の「画像を投稿する」から投稿画面に進めます。
        </p>
        <ul className="list-disc pl-5 text-body">
          <li>ロゴ画像（jpg / png / heic / webp、10MB以下）を選択</li>
          <li>「一口メモ」に作品への思いなどを入力（必須）</li>
          <li>投稿者名は最初に入力した名前がそのまま使われるため、入力欄はありません</li>
        </ul>
        <p className="rounded-md bg-bg-muted p-3 text-caption text-text-muted">
          1人で複数件投稿しても構いません。「投稿する」を押すたびに完了です。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Shot src="/how-to-use/01-top-submission.png" caption="トップ画面（投稿受付中）" />
          <Shot src="/how-to-use/02-upload-filled.png" caption="画像投稿画面" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 3: スワイプで1次選考する</h2>
        <p className="text-body">
          投票受付中になると、投稿されたロゴが1枚ずつランダムな順番で表示されます。
        </p>
        <ul className="list-disc pl-5 text-body">
          <li>
            気に入ったら<strong>右スワイプ、または「♥ キープ」</strong>
          </li>
          <li>
            見送るなら<strong>左スワイプ、または「✕ 次へ」</strong>
          </li>
          <li>スワイプが苦手でも、ボタンで同じ操作ができます</li>
        </ul>
        <p className="rounded-md bg-bg-muted p-3 text-caption text-text-muted">
          <strong className="text-text-base">1枚もキープしないと先に進めません。</strong>
          最低1枚はキープしてください。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Shot src="/how-to-use/03-top-voting.png" caption="トップ画面（投票受付中）" />
          <Shot src="/how-to-use/04-swipe-card.png" caption="スワイプ1次選考" />
          <Shot src="/how-to-use/05-swipe-complete.png" caption="仕分け完了" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 4: 決選投票する</h2>
        <p className="text-body">
          キープした作品がグリッド表示されます。気に入った作品を<strong>最大3つまで</strong>
          タップして選択し、「投票する」を押します。
        </p>
        <p className="rounded-md bg-bg-muted p-3 text-caption text-text-muted">
          <strong className="text-text-base">
            一度投票すると、同じブラウザからは変更・取り消しができません。
          </strong>
          選び終わってから投票してください。
        </p>
        <p className="text-body">投票が完了すると自動的にトップ画面に戻ります。</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Shot src="/how-to-use/06-final-empty.png" caption="決選投票（未選択）" />
          <Shot src="/how-to-use/07-final-selected.png" caption="2つ選択中" />
          <Shot src="/how-to-use/08-top-voted.png" caption="投票完了後のトップ画面" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 5: ランオフ投票する（同着が発生した場合のみ）</h2>
        <p className="text-body">
          決選投票で1位が同数になった場合のみ、運営が「ランオフ」という再投票を行います。開始されると、トップ画面に「⚖️
          ランオフ投票へ進む」ボタンが表示されます。
        </p>
        <ul className="list-disc pl-5 text-body">
          <li>
            同着になった作品の中から<strong>1つだけ</strong>選んで投票します
          </li>
          <li>通常の決選投票（STEP 4）に投票していない場合は参加できません</li>
        </ul>
        <p className="rounded-md bg-bg-muted p-3 text-caption text-text-muted">
          ランオフが発生しなかった場合、この手順はありません。そのまま結果発表をお待ちください。
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Shot src="/how-to-use/09-top-runoff-open.png" caption="ランオフ開始の通知" />
          <Shot src="/how-to-use/10-runoff-empty.png" caption="ランオフ投票（未選択）" />
          <Shot src="/how-to-use/11-runoff-selected.png" caption="1つ選択中" />
          <Shot src="/how-to-use/12-top-runoff-voted.png" caption="投票完了後のトップ画面" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h2">STEP 6: 結果発表を待つ</h2>
        <p className="text-body">
          決選投票（・ランオフ投票）が終わったら、あとは会場のスクリーンでの結果発表をお楽しみください。アプリ上での操作はここまでです。
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-h2">よくある質問</h2>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            名前は本名を入れないといけませんか？
          </summary>
          <p className="pt-2 text-body text-text-muted">
            いいえ、何でも構いません。ニックネームでも問題ありません。
          </p>
        </details>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            ロゴは何件でも投稿できますか？
          </summary>
          <p className="pt-2 text-body text-text-muted">
            はい、投稿受付中であれば同じ人が複数件投稿しても構いません。
          </p>
        </details>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            投稿や投票をやり直したいです。
          </summary>
          <p className="pt-2 text-body text-text-muted">
            投稿は複数件行えますが、決選投票・ランオフ投票は一度送信すると同じブラウザからは変更・取り消しができません。選び終わってから投票してください。
          </p>
        </details>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            スマートフォン以外（PC・タブレット）でも参加できますか？
          </summary>
          <p className="pt-2 text-body text-text-muted">
            参加者向けの画面はスマートフォンでの利用を想定して作られていますが、PC・タブレットのブラウザからでも同じ手順で参加できます。
          </p>
        </details>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            自分が投稿した作品に自分で投票してもいいですか？
          </summary>
          <p className="pt-2 text-body text-text-muted">問題ありません。</p>
        </details>

        <details className="border-b border-bg-muted py-3">
          <summary className="cursor-pointer text-body font-semibold">
            別のスマートフォンで開き直すとどうなりますか？
          </summary>
          <p className="pt-2 text-body text-text-muted">
            投票済みかどうかはブラウザ単位で判定されるため、別の端末・別のブラウザで開き直すと、そちらでも決選投票ができてしまいます。これは個人の識別・認証を目的としたシステムではないためです。参加者どうしの信頼にもとづく運用ですので、1人1回の参加にご協力ください。
          </p>
        </details>

        <details className="py-3">
          <summary className="cursor-pointer text-body font-semibold">
            画面に「準備中」「受付終了」と表示されて操作できません。
          </summary>
          <p className="pt-2 text-body text-text-muted">
            現在のフェーズ（投稿受付中・投票受付中など）に応じて操作できる内容が変わります。運営がフェーズを切り替えるまでお待ちください。
          </p>
        </details>
      </section>
    </main>
  );
}
