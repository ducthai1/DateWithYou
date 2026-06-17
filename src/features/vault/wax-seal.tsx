import { Heart } from "lucide-react";

/** An embossed wine-red wax seal with a gold rim and a heart motif. Pure CSS
 *  (radial gradients + insets) so it scales crisply. Used small on the opened
 *  letter and large/clickable on the sealed envelope. */
export function WaxSeal({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative grid place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 28%, #b5324a 0%, #8b1c31 42%, #5e0f20 100%)",
        boxShadow:
          "inset 0 2px 5px rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.45), 0 6px 16px rgba(94,15,32,0.5)",
      }}
    >
      {/* Notched gold rim */}
      <div
        className="absolute rounded-full"
        style={{
          inset: size * 0.1,
          border: `${Math.max(1, size * 0.02)}px dashed rgba(214,178,96,0.7)`,
        }}
      />
      <Heart
        aria-hidden
        className="relative text-amber-300/90"
        style={{ width: size * 0.4, height: size * 0.4 }}
        fill="currentColor"
        strokeWidth={1}
      />
    </div>
  );
}
