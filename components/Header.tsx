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
    <header className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/75 p-5 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur sm:p-6 dark:border-slate-800/80 dark:bg-slate-950/75 dark:shadow-[0_20px_80px_rgba(2,6,23,0.45)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300/80 dark:text-teal-300/80">
            Public Gallery
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl dark:text-slate-100">
            Dialogue Diaries
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400 dark:text-slate-400">
            Browse full conversation screenshots, filter quickly, and vote on useful chats.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_170px] lg:w-[700px]">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
            Search
            <input
              aria-label="Search conversations"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search title, tags, model, topic"
              className="h-11 rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm font-medium text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
            Sort
            <select
              aria-label="Sort conversations"
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortOption)}
              className="h-11 rounded-xl border border-slate-700 bg-slate-900/80 px-3 text-sm font-medium text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
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
