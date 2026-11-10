"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogoutButton({
  className = "text-xs text-slate-400 hover:text-slate-900",
}: {
  className?: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className={className}
    >
      Sign out
    </button>
  );
}
