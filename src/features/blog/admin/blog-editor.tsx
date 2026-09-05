"use client";

import { useCallback } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, ImagePlus, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "@/features/blog/blog-body.css";

/**
 * The article body editor. TipTap, so what it produces is the same HTML the
 * public page renders — this preview and that page share blog-body.css, so the
 * writer sees the real result. Client-only and code-split into the admin route;
 * none of this reaches the public bundle.
 */
function Btn({
  on, active, disabled, label, children,
}: {
  on: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={on}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-accent text-white" : "hover:bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function BlogEditor({
  value,
  onChange,
  onInsertImage,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Returns a hosted URL for a picked file, or null on failure/cancel. */
  onInsertImage: () => Promise<string | null>;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener" } }),
      Image.configure({ inline: false }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "blog-body min-h-[320px] rounded-b-xl px-4 py-3 outline-none" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const addLink = useCallback((ed: Editor) => {
    const prev = ed.getAttributes("link").href as string | undefined;
    const url = window.prompt("Dán liên kết (để trống để bỏ):", prev ?? "https://");
    if (url === null) return;
    if (url === "") return ed.chain().focus().unsetLink().run();
    ed.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, []);

  const addImage = useCallback(async () => {
    if (!editor) return;
    const url = await onInsertImage();
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor, onInsertImage]);

  if (!editor) return null;

  return (
    <div className="border-border rounded-xl border">
      <div className="border-border bg-muted/40 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b p-1.5">
        <Btn label="Đậm" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn label="Nghiêng" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Btn>
        <span className="bg-border mx-1 h-5 w-px" />
        <Btn label="Tiêu đề lớn" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Btn>
        <Btn label="Tiêu đề nhỏ" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </Btn>
        <span className="bg-border mx-1 h-5 w-px" />
        <Btn label="Danh sách" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Btn>
        <Btn label="Danh sách số" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn label="Trích dẫn" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </Btn>
        <span className="bg-border mx-1 h-5 w-px" />
        <Btn label="Liên kết" active={editor.isActive("link")} on={() => addLink(editor)}>
          <Link2 className="h-4 w-4" />
        </Btn>
        <Btn label="Chèn ảnh" on={addImage}>
          <ImagePlus className="h-4 w-4" />
        </Btn>
        <span className="bg-border mx-1 h-5 w-px" />
        <Btn label="Hoàn tác" disabled={!editor.can().undo()} on={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </Btn>
        <Btn label="Làm lại" disabled={!editor.can().redo()} on={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
