import { NextRequest, NextResponse } from "next/server";
import { isValidRole } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function countAdmins(adminClient: ReturnType<typeof createSupabaseAdminClient>) {
  const { count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (!isValidRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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

  if (id === caller.user.id) {
    return NextResponse.json(
      { error: "You can't change your own role — ask another admin to." },
      { status: 400 }
    );
  }

  if (role === "team") {
    // Don't allow demoting the last remaining admin.
    const { data: target } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    if (target?.role === "admin" && (await countAdmins(adminClient)) <= 1) {
      return NextResponse.json(
        { error: "Can't remove the last admin." },
        { status: 400 }
      );
    }
  }

  const { error } = await adminClient.from("profiles").update({ role }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;

  if (id === caller.user.id) {
    return NextResponse.json(
      { error: "You can't delete your own account — ask another admin to." },
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

  const { data: target } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (target?.role === "admin" && (await countAdmins(adminClient)) <= 1) {
    return NextResponse.json({ error: "Can't remove the last admin." }, { status: 400 });
  }

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
