"use client";

import { useEffect, useState } from "react";
import { qrToPath } from "@/lib/qr-path";

/**
 * The invite link, as a QR code.
 *
 * The encoder is imported only when this component mounts — which is only
 * when somebody opens the invite panel. Nobody pays for it on the map, the
 * calendar or the landing page, and no request leaves the device: the code is
 * drawn from the link, on the phone holding it.
 *
 * Rendered as one `<path>` rather than the library's own SVG, which is one
 * `<rect>` per module. See src/lib/qr-path.ts.
 */
export function InviteQr({ url, label }: { url: string; label: string }) {
  const [path, setPath] = useState<{ d: string; size: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    setPath(null);
    import("qrcode-generator")
      .then(({ default: qrcode }) => {
        if (!alive) return;
        // Type 0 = smallest that fits; "M" corrects ~15% damage, which is the
        // usual choice for a screen somebody photographs at an angle.
        const qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        setPath(qrToPath(qr));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);

  if (failed) {
    // The link below it still works, so this is a missing convenience rather
    // than a broken screen — say that instead of showing a broken box.
    return (
      <p className="text-muted-foreground py-6 text-center text-xs">
        Không vẽ được mã QR — dùng đường liên kết bên dưới nhé.
      </p>
    );
  }

  return (
    <div
      className="border-border mx-auto flex aspect-square w-full max-w-[13rem] items-center justify-center rounded-2xl border bg-white p-3"
      // White regardless of theme: a QR code is read by a camera, and a dark
      // one with light modules is the inverse of what scanners expect.
      style={{ backgroundColor: "#ffffff" }}
    >
      {path ? (
        <svg
          viewBox={`0 0 ${path.size} ${path.size}`}
          className="h-full w-full"
          role="img"
          aria-label={label}
          shapeRendering="crispEdges"
        >
          <path d={path.d} fill="#1c1917" />
        </svg>
      ) : (
        <span className="text-muted-foreground text-xs">Đang vẽ mã…</span>
      )}
    </div>
  );
}
