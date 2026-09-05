"use client";

import { useCallback } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Link2, ImagePlus,
  Undo2, Redo2, Code2, AlignLeft, AlignCenter, AlignRight, Highlighter, SquarePlay as YoutubeIcon,
  Table as TableIcon, Columns3, Rows3, Trash2, Baseline,
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

const Sep = () => <span className="bg-border mx-1 h-5 w-px" />;

/** A few quick text colours plus a free picker; clearing returns to default. */
const SWATCHES = ["#c2410c", "#dc2626", "#2563eb", "#16a34a", "#7c3aed", "#0f172a"];

function ColorMenu({ editor }: { editor: Editor }) {
  const current = (editor.getAttributes("textStyle").color as string) ?? "";
  return (
    <details className="relative">
      <summary
        title="Màu chữ"
        aria-label="Màu chữ"
        className="hover:bg-muted flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md"
      >
        <Baseline className="h-4 w-4" style={current ? { color: current } : undefined} />
      </summary>
      <div className="border-border bg-card absolute left-0 z-20 mt-1 flex w-40 flex-wrap gap-1.5 rounded-lg border p-2 shadow-lg">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Màu ${c}`}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className="h-6 w-6 rounded-full border border-black/10"
            style={{ background: c }}
          />
        ))}
        <label className="hover:bg-muted flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed" title="Chọn màu khác">
          <input
            type="color"
            aria-label="Chọn màu tự do"
            className="h-0 w-0 opacity-0"
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
          />
          +
        </label>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetColor().run()}
          className="hover:bg-muted mt-1 w-full rounded px-2 py-1 text-left text-xs"
        >
          Xoá màu
        </button>
      </div>
    </details>
  );
}

export function BlogEditor({
  value,
  onChange,
  onInsertImages,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Uploads one or more picked files, returns their hosted URLs (empty on cancel). */
  onInsertImages: () => Promise<string[]>;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener" } }),
      Image.configure({ inline: false }),
      Youtube.configure({ controls: true, nocookie: true, width: 640, height: 360 }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
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

  const addImages = useCallback(async () => {
    if (!editor) return;
    const urls = await onInsertImages();
    if (!urls.length) return;
    let chain = editor.chain().focus();
    for (const url of urls) chain = chain.setImage({ src: url });
    chain.run();
  }, [editor, onInsertImages]);

  const addVideo = useCallback((ed: Editor) => {
    const url = window.prompt("Dán liên kết YouTube:");
    if (url) ed.commands.setYoutubeVideo({ src: url });
  }, []);

  if (!editor) return null;
  const inTable = editor.isActive("table");

  return (
    <div className="border-border rounded-xl border">
      <div className="border-border bg-muted/40 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b p-1.5">
        <Btn label="Đậm" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn label="Nghiêng" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Btn>
        <ColorMenu editor={editor} />
        <Btn label="Tô sáng" active={editor.isActive("highlight")} on={() => editor.chain().focus().toggleHighlight({ color: "#fde68a" }).run()}>
          <Highlighter className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Tiêu đề lớn" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Btn>
        <Btn label="Tiêu đề nhỏ" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Căn trái" active={editor.isActive({ textAlign: "left" })} on={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </Btn>
        <Btn label="Căn giữa" active={editor.isActive({ textAlign: "center" })} on={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </Btn>
        <Btn label="Căn phải" active={editor.isActive({ textAlign: "right" })} on={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Danh sách" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Btn>
        <Btn label="Danh sách số" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn label="Trích dẫn" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </Btn>
        <Btn label="Khối mã" active={editor.isActive("codeBlock")} on={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Liên kết" active={editor.isActive("link")} on={() => addLink(editor)}>
          <Link2 className="h-4 w-4" />
        </Btn>
        <Btn label="Chèn ảnh" on={addImages}>
          <ImagePlus className="h-4 w-4" />
        </Btn>
        <Btn label="Chèn video YouTube" on={() => addVideo(editor)}>
          <YoutubeIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Chèn bảng" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="h-4 w-4" />
        </Btn>
        {inTable && (
          <>
            <Btn label="Thêm cột" on={() => editor.chain().focus().addColumnAfter().run()}>
              <Columns3 className="h-4 w-4" />
            </Btn>
            <Btn label="Thêm hàng" on={() => editor.chain().focus().addRowAfter().run()}>
              <Rows3 className="h-4 w-4" />
            </Btn>
            <Btn label="Xoá bảng" on={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 className="h-4 w-4" />
            </Btn>
          </>
        )}
        <Sep />
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
