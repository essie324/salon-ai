import Link from "next/link";

export default function ModulePlaceholder({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: { label: string; href: string }[];
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      {actions?.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
        <p className="font-medium">Placeholder module</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          This route exists so future features can drop in without changing the
          navigation/layout structure.
        </p>
      </div>
    </div>
  );
}

