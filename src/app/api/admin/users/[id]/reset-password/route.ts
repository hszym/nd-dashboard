import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { createSupabaseAdminClient, generateTempPassword } from "@/lib/supabase-admin";

/**
 * Admin only. Gives another member a new temporary password and marks the account so the
 * member must choose their own password at the next sign-in. Your own password is changed
 * on the Account page instead.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;
  if (id === caller.user.id) {
    return NextResponse.json(
      { error: "Change your own password on the Account page." },
      { status: 400 }
    );
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdminClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Not configured" },
      { status: 500 }
    );
  }

  const temporaryPassword = generateTempPassword();
  const { data, error } = await adminClient.auth.admin.updateUserById(id, {
    password: temporaryPassword,
    user_metadata: { must_change_password: true },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Could not reset the password." }, { status: 500 });
  }
  return NextResponse.json({ email: data.user.email, temporaryPassword });
}
