/** Shown the instant a click lands on /blog, before the static page arrives. */
export default function BlogIndexLoading() {
  return (
    <main aria-busy="true" aria-label="Đang tải blog" className="mx-auto w-full max-w-6xl 2xl:max-w-7xl animate-pulse px-4 pb-16 pt-8 sm:pt-12">
      <div className="bg-muted h-4 w-12 rounded" />
      <div className="bg-muted mt-3 h-9 w-72 max-w-full rounded-lg" />
      <div className="bg-muted mt-3 h-4 w-96 max-w-full rounded" />
      <div className="mt-5 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="bg-muted h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="border-border mt-8 grid gap-3 rounded-3xl border p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-muted h-28 rounded-2xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
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
