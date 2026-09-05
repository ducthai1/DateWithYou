"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Counts one view for a post, once, after the page has loaded.
 *
 * The page itself is static (ISR), so the count cannot happen at render — it
 * would be one per revalidate, not one per reader. This is the whole of the
 * client cost on an article page: a single fire-and-forget mutation, no UI.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  const record = trpc.blog.recordView.useMutation();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    record.mutate({ slug });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return null;
}
