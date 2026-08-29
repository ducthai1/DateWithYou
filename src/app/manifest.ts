import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * Web app manifest. Makes "add to home screen" produce a standalone,
 * app-like launch instead of a browser tab, and is one of the installability
 * signals Lighthouse checks under Best Practices / PWA.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Vivu",
    description: SITE_DESCRIPTION,
    start_url: "/home",
    display: "standalone",
    // Matches the mark's tile colour, so the launch splash flows into the
    // brand rather than flashing a different ground first.
    background_color: "#0E3E4A",
    theme_color: "#0E3E4A",
    lang: "vi",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Separate maskable files, not the same art flagged twice: Android crops a
      // maskable icon to a circle, so its artwork is drawn smaller inside a wide
      // safe margin. Reusing the standard icon here would clip the letter.
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
