import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

/**
 * Generated Open Graph card (also reused as the Twitter summary card).
 *
 * Drawn at request time instead of shipped as a static asset so the wording
 * stays in sync with the copy below it, and so there is no 1200x630 PNG to
 * keep re-exporting by hand. Without any og:image at all, every share of this
 * link — Messenger, Zalo, Slack — unfurls as a bare grey rectangle.
 */
export const alt = `${SITE_NAME} — không gian riêng cho hai người`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fdfaf6",
          // Two soft terracotta blooms echoing the aurora mesh on the landing
          // page, so the card and the page read as the same product.
          backgroundImage:
            "radial-gradient(circle at 18% 22%, rgba(244,179,147,0.55), transparent 55%), radial-gradient(circle at 84% 78%, rgba(232,165,152,0.5), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 96, marginBottom: 24 }}>💌</div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            color: "#3b322a",
            letterSpacing: -2,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 28,
            maxWidth: 820,
            textAlign: "center",
            fontSize: 34,
            lineHeight: 1.4,
            color: "#6b5c51",
          }}
        >
          Lịch hẹn hò, bản đồ kỷ niệm và hộp thời gian — gói gọn trong một
          không gian chỉ hai đứa mở được.
        </div>
        <div
          style={{
            marginTop: 44,
            padding: "14px 38px",
            borderRadius: 999,
            backgroundColor: "#c2693f",
            color: "#ffffff",
            fontSize: 28,
          }}
        >
          vivu-noplan.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
