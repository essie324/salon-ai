"use client";

import Link from "next/link";

export default function Topbar({
  title,
  subtitle,
  rightSlot,
  onToggleSidebar,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  onToggleSidebar?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 md:hidden"
          aria-label="Open navigation"
        >
          <span className="text-lg leading-none">☰</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              {title}
            </Link>
          </div>
          {subtitle ? (
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">{rightSlot}</div>
      </div>
    </header>
  );
}

