import { NextRequest, NextResponse } from "next/server";
import { isValidRole, AdminUserRow } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";
import { createSupabaseAdminClient, generateTempPassword } from "@/lib/supabase-admin";

export async function GET() {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
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

  const [{ data: userList, error: listError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 200 }),
      adminClient.from("profiles").select("id, role, display_name, can_sell"),
    ]);

  if (listError || profilesError) {
    return NextResponse.json(
      { error: listError?.message ?? profilesError?.message },
      { status: 500 }
    );
  }

  const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string | null]));
  const sellById = new Map((profiles ?? []).map((p) => [p.id, Boolean(p.can_sell)]));
  const rows: AdminUserRow[] = userList.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      display_name: nameById.get(u.id) ?? null,
      can_sell: sellById.get(u.id) ?? false,
      role: isValidRole(roleById.get(u.id)) ? (roleById.get(u.id) as "admin" | "team") : "team",
      created_at: u.created_at,
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = body?.role;
  const displayName = typeof body?.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";
  const canSell = body?.can_sell === true;
  if (!email || !isValidRole(role)) {
    return NextResponse.json({ error: "Missing or invalid email/role" }, { status: 400 });
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
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    // The new member must choose their own password at the first sign-in.
    user_metadata: { must_change_password: true },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create the account." },
      { status: 500 }
    );
  }

  // New accounts default to "team" (and a name taken from the email) via the
  // on_auth_user_created trigger — only touch them for admin or a chosen name.
  const patch: Record<string, string | boolean> = {};
  if (role === "admin") patch.role = "admin";
  if (displayName) patch.display_name = displayName;
  if (canSell) patch.can_sell = true;
  if (Object.keys(patch).length) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(patch)
      .eq("id", created.user.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ email, role, temporaryPassword });
}
