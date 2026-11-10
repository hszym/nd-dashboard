import { getRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import AppChrome from "@/components/AppChrome";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user ? await getRole(supabase, user.id) : null;

  return <AppChrome role={role ?? null}>{children}</AppChrome>;
}
