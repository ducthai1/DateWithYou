import { SITE_WIDTH } from "@/lib/site-width";

/** A category page's grid, drawn while the static page loads. */
export default function CategoryLoading() {
  return (
    <main aria-busy="true" aria-label="Đang tải danh mục" className={`mx-auto w-full ${SITE_WIDTH} animate-pulse px-4 pb-16 pt-8 sm:pt-12`}>
      <div className="bg-muted h-4 w-32 rounded" />
      <div className="bg-muted mt-3 h-9 w-56 rounded-lg" />
      <div className="mt-5 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-muted h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="border-border overflow-hidden rounded-2xl border">
            <div className="bg-muted aspect-[16/9]" />
            <div className="space-y-2 p-4">
              <div className="bg-muted h-4 w-3/4 rounded" />
              <div className="bg-muted h-3 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
