import Link from "next/link";
import { cookies } from "next/headers";
import { ROLE_COOKIE, isValidRole } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const roleValue = cookieStore.get(ROLE_COOKIE)?.value;
  const role = isValidRole(roleValue) ? roleValue : null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
              ND
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              Case Dashboard
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-600 hover:text-slate-900">
              Cases
            </Link>
            {role === "admin" && (
              <Link
                href="/cases/new"
                className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
              >
                + New case
              </Link>
            )}
            {role === "team" && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                Team view
              </span>
            )}
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Internal tool — not for external distribution
      </footer>
    </div>
  );
}
