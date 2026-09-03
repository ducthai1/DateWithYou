"use client";

import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import { readableFormError } from "@/lib/form-error";
import { PhotoView } from "react-photo-view";
import { trpc } from "@/lib/trpc";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToast } from "@/components/ui/toast";

export type DayMemory = {
  id: string;
  title: string;
  caption: string | null;
  date: string;
  tags: string[];
  embeds: { url: string }[];
  photos: { url: string; publicId: string }[];
};

/**
 * The day's photos, right where the day is being read.
 *
 * Without this the only way to see or drop a picture attached to a date was to
 * leave the calendar for the memories section and find it there by hand. Each
 * thumbnail zooms, and deleting one rewrites its memory's photo list rather
 * than deleting the memory — the title and caption someone wrote survive a
 * removed picture.
 */
export function DayPhotos({
  date,
  memories,
  onEdit,
  onAdd,
}: {
  date: string;
  memories: DayMemory[];
  onEdit: (m: DayMemory) => void;
  onAdd: () => void;
}) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const update = trpc.memory.update.useMutation({
    onSuccess: () => {
      utils.calendar.dayDetail.invalidate({ date });
      utils.memory.list.invalidate();
      toast("Đã xoá ảnh", "success");
    },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });

  const withPhotos = memories.filter((m) => m.photos.length > 0);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-medium">
          Ảnh trong ngày
          <span className="ml-1 text-xs font-normal opacity-70">
            ({withPhotos.reduce((n, m) => n + m.photos.length, 0)})
          </span>
        </h3>
        <button
          type="button"
          onClick={onAdd}
          className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors"
        >
          <ImagePlus className="h-3.5 w-3.5" /> Thêm ảnh
        </button>
      </div>

      {withPhotos.length === 0 ? (
        <p className="text-muted-foreground text-xs">Chưa có ảnh nào cho ngày này.</p>
      ) : (
        <div className="space-y-3">
          {withPhotos.map((m) => (
            <div key={m.id} className="bg-card border-border rounded-xl border p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{m.title}</p>
                <button
                  type="button"
                  aria-label={`Sửa kỷ niệm ${m.title}`}
                  title="Sửa"
                  onClick={() => onEdit(m)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {m.photos.map((p) => (
                  <div key={p.publicId} className="group relative">
                    <PhotoView src={p.url}>
                      <img
                        src={p.url}
                        alt=""
                        className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                      />
                    </PhotoView>
                    <ConfirmButton
                      idle=""
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      aria-label="Xoá ảnh này"
                      title="Xoá ảnh này?"
                      description={`Ảnh sẽ bị xoá khỏi "${m.title}". Không hoàn tác được.`}
                      disabled={update.isPending}
                      className="bg-card/90 text-muted-foreground hover:bg-destructive-soft hover:text-destructive absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg shadow-sm transition-colors"
                      onConfirm={() =>
                        update.mutate({
                          id: m.id,
                          photos: m.photos.filter((x) => x.publicId !== p.publicId),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
