"use client";

export type SortOption = "newest" | "oldest" | "top";

type HeaderProps = {
  search: string;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
};

export default function Header({ search, sort, onSearchChange, onSortChange }: HeaderProps) {
  return (
    <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Public Gallery
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            ChatGPT Screenshot Gallery
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Browse full conversation screenshots, filter quickly, and vote on useful chats.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_170px] lg:w-[560px]">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
            <input
              aria-label="Search conversations"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search title, tags, model, topic"
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort
            <select
              aria-label="Sort conversations"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortOption)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="top">Top</option>
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
