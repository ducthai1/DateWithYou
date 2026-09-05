"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { slugify } from "@/lib/slug";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { cldThumb } from "@/lib/cloudinary-url";
import { readableFormError } from "@/lib/form-error";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL } from "@/features/blog/post-card";
import { BlogEditor } from "./blog-editor";
import { ImagePlus, Loader2, X } from "lucide-react";

const CATEGORIES = ["tin-tuc", "tinh-nang", "meo-hay", "cap-nhat"] as const;

export type BlogFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImage: string;
  category: (typeof CATEGORIES)[number];
  tags: string[];
  featured: boolean;
  status: "draft" | "published";
  metaTitle: string;
  metaDescription: string;
};

const EMPTY: BlogFormValues = {
  title: "", slug: "", excerpt: "", body: "", coverImage: "",
  category: "tin-tuc", tags: [], featured: false, status: "draft",
  metaTitle: "", metaDescription: "",
};

const field = "border-border focus:border-accent w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none";
const label = "text-foreground mb-1 block text-sm font-medium";

/** Pick one image and upload it through the admin-signed Cloudinary flow. */
function useBlogImageUpload() {
  const signBlog = trpc.upload.signBlog.useMutation();
  return useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const up = await uploadToCloudinary(file, { sign: () => signBlog.mutateAsync() });
          resolve(up.url);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  }, [signBlog]);
}

/** Pick one or more images and upload them through the admin-signed Cloudinary flow. */
function useBlogImagesUpload() {
  const signBlog = trpc.upload.signBlog.useMutation();
  return useCallback((): Promise<string[]> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.multiple = true;
      input.onchange = async () => {
        const files = Array.from(input.files ?? []);
        if (!files.length) return resolve([]);
        try {
          const ups = await Promise.all(
            files.map((f) => uploadToCloudinary(f, { sign: () => signBlog.mutateAsync() })),
          );
          resolve(ups.map((u) => u.url));
        } catch {
          resolve([]);
        }
      };
      input.click();
    });
  }, [signBlog]);
}

export function BlogForm({ initial }: { initial?: BlogFormValues }) {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [v, setV] = useState<BlogFormValues>(initial ?? EMPTY);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [tagInput, setTagInput] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const pickImage = useBlogImageUpload();
  const pickImages = useBlogImagesUpload();
  const isEdit = Boolean(v.id);

  const set = useCallback(<K extends keyof BlogFormValues>(k: K, val: BlogFormValues[K]) => {
    setV((cur) => ({ ...cur, [k]: val }));
  }, []);

  // Slug tracks the title until the author edits the slug themselves.
  const previewSlug = useMemo(
    () => (slugTouched ? v.slug : slugify(v.title)),
    [slugTouched, v.slug, v.title],
  );

  const create = trpc.blog.create.useMutation();
  const update = trpc.blog.update.useMutation();

  const submit = useCallback(
    async (status: "draft" | "published") => {
      if (!v.title.trim()) return toast("Cần có tiêu đề", "error");
      const payload = {
        title: v.title.trim(),
        slug: slugTouched ? v.slug : undefined,
        excerpt: v.excerpt.trim(),
        body: v.body,
        coverImage: v.coverImage || "",
        category: v.category,
        tags: v.tags,
        featured: v.featured,
        status,
        metaTitle: v.metaTitle.trim() || undefined,
        metaDescription: v.metaDescription.trim() || undefined,
      };
      try {
        if (isEdit && v.id) {
          await update.mutateAsync({ id: v.id, ...payload });
        } else {
          await create.mutateAsync(payload);
        }
        await utils.blog.adminList.invalidate();
        toast(status === "published" ? "Đã đăng bài ✓" : "Đã lưu nháp ✓", "success");
        router.push("/admin/blog");
      } catch (e) {
        toast(readableFormError(e instanceof Error ? e.message : "", "Không lưu được"), "error");
      }
    },
    [v, slugTouched, isEdit, create, update, utils, toast, router],
  );

  const saving = create.isPending || update.isPending;

  const addCover = async () => {
    setCoverBusy(true);
    const url = await pickImage();
    if (url) set("coverImage", url);
    setCoverBusy(false);
  };
  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !v.tags.includes(t) && v.tags.length < 12) set("tags", [...v.tags, t]);
    setTagInput("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="border-border bg-card space-y-4 rounded-3xl border p-5 shadow-sm sm:p-6">
        <div>
          <label className={label}>Tiêu đề</label>
          <input
            aria-label="Tiêu đề"
            className={field}
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Tính năng mới: …"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Đường dẫn: <code className="text-foreground">/blog/{previewSlug || "…"}</code>
          </p>
        </div>

        <div>
          <label className={label}>Tóm tắt</label>
          <textarea
            aria-label="Tóm tắt"
            className={field}
            rows={2}
            value={v.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            placeholder="Một hai câu cho thẻ bài và mô tả SEO."
          />
        </div>

        <div>
          <label className={label}>Nội dung</label>
          <BlogEditor value={v.body} onChange={(html) => set("body", html)} onInsertImages={pickImages} />
        </div>
      </div>

      <aside className="space-y-5">
        <div className="border-border bg-card space-y-3 rounded-2xl border p-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submit("published")} disabled={saving} className="flex-1 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {v.status === "published" || !isEdit ? "Đăng" : "Đăng lại"}
            </Button>
            <Button variant="outline" onClick={() => void submit("draft")} disabled={saving}>
              Lưu nháp
            </Button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" aria-label="Đánh dấu nổi bật" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} />
            Đánh dấu nổi bật
          </label>
        </div>

        <div className="border-border bg-card space-y-5 rounded-2xl border p-4 shadow-sm">
        <div>
          <label className={label}>Ảnh bìa</label>
          {v.coverImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cldThumb(v.coverImage, 480)} alt="" className="aspect-[16/9] w-full rounded-lg object-cover" />
              <button
                type="button"
                aria-label="Bỏ ảnh bìa"
                onClick={() => set("coverImage", "")}
                className="bg-card/90 absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={addCover}
              disabled={coverBusy}
              className="border-border text-muted-foreground hover:bg-muted flex aspect-[16/9] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm"
            >
              {coverBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              Chọn ảnh bìa
            </button>
          )}
        </div>

        <div>
          <label className={label}>Danh mục</label>
          <select className={field} value={v.category} onChange={(e) => set("category", e.target.value as BlogFormValues["category"])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={label}>Thẻ</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {v.tags.map((t) => (
              <span key={t} className="bg-muted flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                #{t}
                <button type="button" aria-label={`Bỏ thẻ ${t}`} onClick={() => set("tags", v.tags.filter((x) => x !== t))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            aria-label="Thêm thẻ"
            className={field}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Gõ rồi Enter"
          />
        </div>

        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer">SEO (tuỳ chọn)</summary>
          <div className="mt-2 space-y-2">
            <input aria-label="Meta title" className={field} value={v.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} placeholder="Meta title (mặc định: tiêu đề)" />
            <textarea aria-label="Meta description" className={field} rows={2} value={v.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} placeholder="Meta description (mặc định: tóm tắt)" />
            <input
              aria-label="Slug"
              className={field}
              value={slugTouched ? v.slug : ""}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }}
              placeholder={`Slug (mặc định: ${slugify(v.title) || "tự sinh"})`}
            />
          </div>
        </details>
        </div>
      </aside>
    </div>
  );
}
