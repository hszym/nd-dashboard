"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

type Role = "admin" | "team" | null;

/**
 * Home ("/") has no top bar: just a small floating glass pill with the few
 * controls. Every other page gets a slim bar with a way back home.
 */
export default function AppChrome({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  // A single deal page (/cases/<slug>) shares home's dark glass look; the
  // create/track forms stay on the light layout.
  const isDeal = /^\/cases\/[^/]+\/?$/.test(pathname) && pathname !== "/cases/new";
  const immersive = isHome || isDeal;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {immersive ? (
        <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 flex items-center gap-4 rounded-full glass px-4 py-2 text-xs text-slate-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)]">
          {isDeal && (
            <Link href="/" className="font-medium hover:text-slate-500">
              ← All deals
            </Link>
          )}
          {role === "admin" && (
            <Link href="/users" className="font-medium hover:text-slate-500">
              Manage users
            </Link>
          )}
          <Link href="/tokens" className="font-medium hover:text-slate-500">
            API tokens
          </Link>
          <LogoutButton className="text-xs text-slate-500 hover:text-slate-900" />
        </div>
      ) : (
        <header className="relative z-10 border-b border-slate-200/60 bg-white/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <span aria-hidden>←</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold text-white">
                ND
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {role === "admin" && (
                <Link href="/users" className="text-slate-600 hover:text-slate-900">
                  Manage users
                </Link>
              )}
              <Link href="/tokens" className="text-slate-600 hover:text-slate-900">
                API tokens
              </Link>
              {role === "team" && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  Team view
                </span>
              )}
              <LogoutButton />
            </nav>
          </div>
        </header>
      )}

      <main
        className={`mx-auto w-full flex-1 ${
          isHome
            ? "flex flex-col justify-center px-0 pb-16 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]"
            : isDeal
              ? "px-0 pb-16 pt-[max(4.75rem,calc(env(safe-area-inset-top)+3.75rem))]"
              : "max-w-6xl px-6 py-8"
        }`}
      >
        {children}
      </main>

      {!immersive && (
        <footer className="relative z-10 border-t border-slate-200/60 bg-white/60 py-4 text-center text-xs text-slate-500 backdrop-blur-xl">
          Internal tool — not for external distribution
        </footer>
      )}
    </div>
  );
}
