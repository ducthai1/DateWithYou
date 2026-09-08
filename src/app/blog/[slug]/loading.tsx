/** The article's shape, drawn immediately so a press is never silent. */
export default function ArticleLoading() {
  return (
    <main aria-busy="true" aria-label="Đang mở bài viết" className="mx-auto w-full max-w-6xl 2xl:max-w-7xl animate-pulse px-4 pb-16 pt-6 sm:pt-10">
      <div className="bg-muted h-4 w-32 rounded" />
      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="border-border rounded-3xl border p-5 sm:p-8">
          <div className="bg-muted h-4 w-16 rounded" />
          <div className="bg-muted mt-3 h-9 w-full rounded-lg" />
          <div className="bg-muted mt-2 h-9 w-2/3 rounded-lg" />
          <div className="bg-muted mt-4 h-3 w-28 rounded" />
          <div className="bg-muted mt-8 aspect-[16/10] w-full rounded-2xl" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="bg-muted h-3.5 rounded" style={{ width: `${[100, 96, 92, 100, 88, 97, 70][i]}%` }} />
            ))}
          </div>
        </div>
        <div className="border-border hidden h-56 rounded-2xl border p-4 lg:block">
          <div className="bg-muted h-3.5 w-20 rounded" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-muted h-3 rounded" style={{ width: `${[90, 70, 80, 60, 85, 65][i]}%` }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
