"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_STRATEGY_HREF, type NavItem } from "@/app/lib/roles";

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Browsers treat `//dashboard/...` as protocol-relative → wrong host `dashboard` (“site can’t be reached”). */
function normalizeNavHref(href: string): string {
  const h = href.trim();
  if (
    h.startsWith("http://") ||
    h.startsWith("https://") ||
    h.startsWith("mailto:") ||
    h.startsWith("tel:")
  ) {
    return h;
  }
  if (h.startsWith("//")) {
    return `/${h.slice(2)}`;
  }
  if (!h.startsWith("/")) {
    return `/${h}`;
  }
  return h;
}

export default function SidebarNav({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() || "";

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const href =
          item.label === "Strategy" ? DASHBOARD_STRATEGY_HREF : normalizeNavHref(item.href);
        const active = isActive(pathname, href);
        return (
          <Link
            key={`${item.label}:${href}`}
            href={href}
            prefetch={false}
            onClick={onNavigate}
            className={[
              "block rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900/50 dark:hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

