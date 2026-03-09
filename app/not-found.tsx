import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">Conversation not found</h1>
      <p className="mt-2 text-sm text-slate-400">
        This conversation may have been renamed or removed from the gallery.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
      >
        Return to gallery
      </Link>
    </main>
  );
}
