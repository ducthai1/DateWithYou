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
    /*
     * The home-screen label, and it has to be the whole name.
     *
     * "Vivu" alone belongs to a different site, so an install left people with
     * a shortcut that named someone else's product. Twelve characters is right
     * at what Android and iOS show before they truncate, so this is the longest
     * form that still lands intact — and the one worth spending it on.
     */
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/home",
    display: "standalone",
    // Matches the mark's tile colour, so the launch splash flows into the
    // brand rather than flashing a different ground first. The icon and all
    // 24 iOS launch images were rebuilt on a navy #1E3A5F tile (picked by
    // rendering the mark at 16px against four candidate grounds); this used
    // to read teal (#0E3E4A) from before that rebuild, which left Android's
    // generated splash ground mismatched against the icon it surrounds.
    background_color: "#1E3A5F",
    theme_color: "#1E3A5F",
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
