import Image from "next/image";

/**
 * The Vivu logo, used in the header / sidebar.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/logo.png"
        alt="Vivu No Plan"
        fill
        className="object-contain"
        sizes="48px"
      />
    </div>
  );
}
