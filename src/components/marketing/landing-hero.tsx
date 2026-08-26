"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

/*
 * The landing hero, unchanged in look from the original single-screen page —
 * only lifted out of app/page.tsx so that route can become a Server Component
 * and export real metadata (a "use client" page cannot). framer-motion and the
 * animated mesh keep this client-side; everything below the fold is static and
 * server-rendered.
 */
export function LandingHero() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#fdfaf6] selection:bg-[#c2693f]/20">
      {/* 1. Film Grain Noise Layer for Premium Texture */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025] mix-blend-multiply" 
        style={{ 
          backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" 
        }} 
      />

      {/* 2. Fullscreen Aurora / Mesh Gradient Background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          animate={{
            x: ["0%", "5%", "-5%", "0%"],
            y: ["0%", "-10%", "5%", "0%"],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-[20%] -top-[10%] h-[70vh] w-[70vw] rounded-[100%] bg-gradient-to-br from-[#f4b393]/40 to-[#e8a598]/40 mix-blend-multiply blur-[80px] md:blur-[120px]"
        />
        <motion.div
          animate={{
            x: ["0%", "-10%", "5%", "0%"],
            y: ["0%", "10%", "-5%", "0%"],
            scale: [1, 1.05, 1.15, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -right-[10%] top-[20%] h-[80vh] w-[60vw] rounded-[100%] bg-gradient-to-bl from-[#dca08f]/30 to-[#f4b393]/30 mix-blend-multiply blur-[90px] md:blur-[130px]"
        />
        <motion.div
          animate={{
            x: ["0%", "8%", "-8%", "0%"],
            y: ["0%", "-8%", "8%", "0%"],
            scale: [1, 1.2, 0.95, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute -bottom-[20%] left-[10%] h-[60vh] w-[80vw] rounded-[100%] bg-gradient-to-tr from-[#f6e6dc]/60 to-[#e8a598]/40 mix-blend-multiply blur-[100px] md:blur-[140px]"
        />
      </div>

      {/* 3. Main Content: Elegant, Breathing, Premium Typography */}
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6">
        
        <motion.div
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} // smooth apple-like spring
        >
          {/* Subtle Floating Icon */}
          {/* The brand mark, not an emoji. Two reasons: it is the actual
              identity, and it was the page's ONLY candidate for a Search
              thumbnail — before this the whole landing page contained zero
              <img> elements, so Google had no image to attach to the result.
              `priority` because it sits above the fold. */}
          <motion.div
            animate={{
              y: [0, -8, 0],
              rotate: [-2, 2, -2],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="mb-8 drop-shadow-sm"
          >
            <Image
              src="/logo_tab.png"
              alt="Vivu No Plan — chim én bay theo con đường và la bàn"
              width={530}
              height={471}
              priority
              className="h-24 w-auto sm:h-28"
            />
          </motion.div>

          <h1 className="font-serif text-4xl font-medium tracking-tight text-[#3b322a] drop-shadow-sm sm:text-5xl md:text-6xl whitespace-nowrap">
            Vivu No Plan
          </h1>
          
          <p className="mt-8 px-2 text-base font-light leading-relaxed text-[#6b5c51] sm:text-lg">
            Nơi lưu kỷ niệm, lên kế hoạch hẹn hò và giữ những điều bí mật ngọt ngào của tụi mình.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="mt-14 flex w-full flex-col gap-4 px-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            href="/map"
            className="group relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full bg-[#c2693f] text-white shadow-[0_8px_20px_rgba(194,105,63,0.25)] transition-all hover:bg-[#a8542f] hover:shadow-[0_12px_24px_rgba(194,105,63,0.35)] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
          >
            <span className="relative z-10 text-[17px] font-medium tracking-wide">
              Vào không gian
            </span>
            {/* Elegant sweep hover shine */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
          </Link>

          <Link
            href="/sign-up"
            className="flex h-14 w-full items-center justify-center rounded-full border border-[#d8cfc1]/80 bg-white/40 text-[#6f675d] backdrop-blur-md transition-all hover:bg-white/70 hover:border-[#d8cfc1] active:scale-[0.98]"
          >
            <span className="text-[17px] font-medium tracking-wide">
              Tạo tài khoản
            </span>
          </Link>
        </motion.div>

        {/* Scroll affordance. The hero is min-h-dvh, so on a normal screen the
            sections below it sit entirely past the fold with nothing hinting
            they exist. Anchored to the intro section rather than a bare arrow
            so keyboard users get a real, focusable jump target. */}
        <motion.a
          href="#gioi-thieu"
                    className="absolute inset-x-0 bottom-8 mx-auto flex w-fit flex-col items-center gap-2 rounded-full px-4 py-2 text-[#7a6d60] transition-colors hover:text-[#c2693f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c2693f]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          <span className="text-xs font-light tracking-wide">Tìm hiểu thêm</span>
          <motion.span
            aria-hidden="true"
            className="text-lg leading-none"
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            ↓
          </motion.span>
        </motion.a>

      </main>
    </div>
  );
}
