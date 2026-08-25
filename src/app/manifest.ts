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
    start_url: "/",
    display: "standalone",
    // Matches the `themeColor` in the root layout viewport so the launch
    // splash does not flash a different colour than the app itself.
    background_color: "#f1ece3",
    theme_color: "#f1ece3",
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
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
