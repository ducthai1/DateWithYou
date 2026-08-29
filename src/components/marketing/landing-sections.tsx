import Link from "next/link";
import { Reveal } from "./reveal";
import { ToneArt } from "@/components/theme/tone-art";
import { FaqItem } from "./faq-item";
import { FAQ, FEATURES, STEPS } from "./landing-content";
import { SITE_NAME } from "@/lib/site";

/*
 * Everything below the hero. Plain Server Components on purpose: this is the
 * only substantial text a crawler can read on the whole site, so it ships in
 * the initial HTML with no JavaScript attached to it.
 *
 * Palette is hard-coded to the hero's warm parchment set (#fdfaf6 / #3b322a /
 * #6b5c51 / #c2693f) rather than the app's theme tokens — the landing is not
 * inside a shared space, so the per-space accent preset does not apply here
 * and the page must look identical to every visitor.
 */

function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /** "left" is for a heading sharing a row with an image half — it stays
   *  centred below lg, where there is no second column to sit beside. */
  align?: "center" | "left";
}) {
  return (
    <div
      className={`mx-auto max-w-2xl text-center ${align === "left" ? "lg:mx-0 lg:text-left" : ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#a8542f]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-3xl font-medium tracking-tight text-[#3b322a] sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-5 text-base font-light leading-relaxed text-[#6b5c51]">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

export function LandingSections() {
  return (
    <div className="relative bg-[#fdfaf6] text-[#3b322a]">
      {/* Intro — the one paragraph that answers "what is this?" in prose.
          Crawlers weight early body copy heavily, and the hero above is only
          a headline plus one line.

          Two columns above lg, text against `memoriesScrapbook`: this was the
          first of the plain centred-text sections down the page, and pairing
          it with the one piece of art that is literally about keeping
          moments matches what the paragraph is arguing. Image sits on the
          right — the steps band further down mirrors this with its own
          artwork on the left, so the page alternates rather than lining every
          picture up on the same side. */}
      <section id="gioi-thieu" className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <SectionHeading
                eyebrow="Giới thiệu"
                title={`${SITE_NAME} là gì?`}
                lead="Là một góc riêng để giữ lại những nơi đã đi qua, tấm ảnh của hôm nào đó, kế hoạch đi chơi cuối tuần này và cả những điều chưa muốn nói ra vội — tất cả nằm gọn ở một chỗ, thay vì trôi mất giữa hàng nghìn tin nhắn."
                align="left"
              />
            </Reveal>
            <Reveal delay={180}>
              <p className="mx-auto mt-8 max-w-2xl text-center text-base font-light leading-relaxed text-[#6b5c51] lg:mx-0 lg:text-left">
                Không bảng tin, không người lạ, không thuật toán gợi ý. Đi một
                mình thì đây là góc của riêng bạn. Có người đi cùng thì ai thêm
                gì vào, người kia thấy gần như ngay — khỏi chụp màn hình gửi
                qua gửi lại.
              </p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <div className="overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 bg-white/50 shadow-[0_12px_40px_rgba(59,50,42,0.08)]">
              <ToneArt
                name="memoriesScrapbook"
                sizes="(max-width: 1024px) 100vw, 480px"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/*
        The one picture on the way down the page.

        Everything from the hero to the FAQ was type on parchment — accurate to
        the product's calm, but it never showed the product. This band answers
        "what does it actually look like" once, in the place a reader asks it:
        straight after the paragraph explaining what the app is and before the
        list of what it does.

        Not next/image with priority — the hero above is the LCP element and is
        hand-tuned webp/jpg for exactly that reason. This one loads lazily so it
        cannot compete for it.
      */}
      <section className="px-6 pb-4 sm:pb-8">
        <Reveal>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 bg-white/50 shadow-[0_12px_40px_rgba(59,50,42,0.08)]">
            <ToneArt
              name="appShowcase"
              sizes="(max-width: 1024px) 100vw, 900px"
            />
          </div>
        </Reveal>
      </section>

      <div className="mx-auto h-px max-w-4xl bg-[#d8cfc1]/60" />

      {/* Features — the substance of the page. */}
      <section id="tinh-nang" className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Tính năng"
          title="Bảy thứ bạn sẽ dùng nhiều nhất"
            lead="Mỗi mục dưới đây là một màn hình có sẵn trong ứng dụng, không phải kế hoạch cho tương lai. Bốn thứ được dùng nhiều nhất có trang riêng nói kỹ hơn."
          />
        </Reveal>
        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal
              as="li"
              key={feature.title}
              /* Cap the stagger: past a handful of cards a growing delay stops
                 reading as rhythm and starts reading as lag. */
              delay={Math.min(i, 5) * 110}
              className="rounded-3xl border border-[#d8cfc1]/70 bg-white/50 p-7 backdrop-blur-sm transition-colors hover:border-[#c2693f]/40 hover:bg-white/80"
            >
              <span className="text-3xl" aria-hidden="true">
                {feature.emoji}
              </span>
              <h3 className="mt-5 text-lg font-medium text-[#3b322a]">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] font-light leading-relaxed text-[#6b5c51]">
                {feature.body}
              </p>
              {feature.href ? (
                <Link
                  href={feature.href}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[#a8542f] transition-opacity hover:opacity-70"
                >
                  Xem chi tiết <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </Reveal>
          ))}
        </ul>
        <Reveal>
          <div className="mt-12 text-center">
            <Link
              href="/tinh-nang"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfc1]/80 bg-white/40 px-6 py-3 text-[15px] font-medium text-[#6f675d] transition-colors hover:border-[#c2693f]/40 hover:text-[#a8542f]"
            >
              Xem tất cả tính năng <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Reveal>
      </section>

      <div className="mx-auto h-px max-w-4xl bg-[#d8cfc1]/60" />

      {/* Steps — the second of the two alternating image bands. `tripPlanner`
          on the left this time (the intro band above put its artwork on the
          right), and matches the section's own subject: getting a trip
          moving. The three steps drop from a 3-column row to a stack, since
          they now share the row with an image instead of the full width. */}
      <section id="bat-dau" className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        {/* Text block written first in source, same as the intro band above,
            so mobile always reads heading-then-picture regardless of which
            side the picture lands on at lg. `lg:order-first` is what actually
            moves the artwork to the left column once there is a row to have
            a side at all. */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="lg:order-last">
            <Reveal>
              <SectionHeading eyebrow="Bắt đầu" title="Ba bước là xong" align="left" />
            </Reveal>
            <ol className="mt-10 space-y-8">
              {STEPS.map((step, i) => (
                <Reveal as="li" key={step.number} delay={i * 140}>
                  <span className="text-sm font-medium tracking-[0.2em] text-[#a8542f]">
                    {step.number}
                  </span>
                  <h3 className="mt-4 text-lg font-medium text-[#3b322a]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] font-light leading-relaxed text-[#6b5c51]">
                    {step.body}
                  </p>
                </Reveal>
              ))}
            </ol>
          </div>
          <Reveal delay={120} className="lg:order-first">
            <div className="overflow-hidden rounded-[28px] border border-[#d8cfc1]/70 bg-white/50 shadow-[0_12px_40px_rgba(59,50,42,0.08)]">
              <ToneArt
                name="tripPlanner"
                sizes="(max-width: 1024px) 100vw, 480px"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto h-px max-w-4xl bg-[#d8cfc1]/60" />

      {/* FAQ — mirrored verbatim into the FAQPage JSON-LD on the route. Native
          <details> so the answers exist in the HTML even while collapsed;
          hiding them behind JavaScript would hide them from crawlers too. */}
      <section id="hoi-dap" className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
        <Reveal>
          <SectionHeading eyebrow="Hỏi đáp" title="Câu hỏi thường gặp" />
        </Reveal>
        <Reveal delay={160}>
        <div className="mt-14 divide-y divide-[#d8cfc1]/60 border-y border-[#d8cfc1]/60">
          {FAQ.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
        </Reveal>
      </section>

      {/* Closing call to action */}
      <section id="dang-ky" className="mx-auto max-w-3xl px-6 pb-24 text-center sm:pb-32">
        <Reveal>
        <h2 className="text-3xl font-medium tracking-tight text-[#3b322a] sm:text-4xl">
          Mở góc riêng của bạn
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base font-light leading-relaxed text-[#6b5c51]">
          Miễn phí, không quảng cáo, không cần thẻ thanh toán. Mất chừng một
          phút để tạo xong — và bạn không cần rủ ai để bắt đầu.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/sign-up"
            className="flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-[#c2693f] text-[17px] font-medium tracking-wide text-white shadow-[0_8px_20px_rgba(194,105,63,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#a8542f] active:translate-y-0 active:scale-[0.98]"
          >
            Tạo tài khoản
          </Link>
          <Link
            href="/sign-in"
            className="flex h-14 w-full max-w-xs items-center justify-center rounded-full border border-[#d8cfc1]/80 bg-white/40 text-[17px] font-medium tracking-wide text-[#6f675d] backdrop-blur-md transition-all hover:border-[#d8cfc1] hover:bg-white/70 active:scale-[0.98]"
          >
            Đã có tài khoản
          </Link>
        </div>
        </Reveal>
      </section>

      <footer className="border-t border-[#d8cfc1]/60 px-6 py-10 text-center text-sm font-light text-[#7a6d60]">
        <p>
          {SITE_NAME} — giữ lại những chuyến đi của bạn. Làm tại Việt Nam.
        </p>
        <p className="mt-2">
          <Link href="/tinh-nang" className="transition-colors hover:text-[#a8542f]">
            Tính năng
          </Link>
        </p>
      </footer>
    </div>
  );
}
