import { supabase, CaseRound } from "@/lib/supabase";

const COLUMNS = "id, case_id, name, sort, status, currency, amount_target, amount_remaining, deadline";

export async function loadRounds(caseId: string): Promise<CaseRound[]> {
  const { data } = await supabase
    .from("case_rounds")
    .select(COLUMNS)
    .eq("case_id", caseId)
    .order("sort");
  return (data ?? []) as CaseRound[];
}

/** Adds a round after the existing ones (admins only; the database enforces it). */
export async function createRound(
  caseId: string,
  existing: CaseRound[],
  name: string,
  currency: string
): Promise<{ round: CaseRound | null; error: string | null }> {
  const sort = existing.reduce((m, r) => Math.max(m, r.sort), -1) + 1;
  const { data, error } = await supabase
    .from("case_rounds")
    .insert({ case_id: caseId, name, sort, currency })
    .select(COLUMNS)
    .single();
  return { round: (data as CaseRound | null) ?? null, error: error?.message ?? null };
}

export async function updateRound(
  id: string,
  patch: Partial<Pick<CaseRound, "name" | "status" | "currency" | "amount_target" | "amount_remaining" | "deadline">>
): Promise<string | null> {
  const { error } = await supabase.from("case_rounds").update(patch).eq("id", id);
  return error?.message ?? null;
}

/** Deletes a round together with its Term Sheet, 2-pager and Case Review. */
export async function deleteRound(id: string): Promise<string | null> {
  const { error } = await supabase.from("case_rounds").delete().eq("id", id);
  return error?.message ?? null;
}
