import { supabase } from "@/lib/supabase";

/** What a task is: an open question, a document to provide, or a tracker to-do. */
export type TaskKind = "question" | "document" | "todo";

/** One row of the `my_open_tasks` view (all open tasks; `assignee_id` null = nobody has it yet). */
export interface Task {
  kind: TaskKind;
  id: string;
  case_id: string | null;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  priority: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
}

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  question: "Question",
  document: "Document",
  todo: "To-do",
};

/** The team directory, for choosing who a task goes to. */
export async function loadTeam(): Promise<TeamMember[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.display_name as string | null)?.trim() || "Unnamed",
  }));
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Open tasks: the signed-in person's own, and the unassigned questions anyone can take. */
export async function loadTasks(
  userId: string
): Promise<{ mine: Task[]; toTake: Task[] }> {
  const { data } = await supabase
    .from("my_open_tasks")
    .select("*")
    .or(`assignee_id.eq.${userId},and(kind.eq.question,assignee_id.is.null)`)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as Task[];
  return {
    mine: rows.filter((t) => t.assignee_id === userId),
    toTake: rows.filter((t) => t.assignee_id === null),
  };
}

/** Open tasks per deal (by case id): the person's own, and the questions nobody has taken yet. */
export async function loadTaskCounts(
  userId: string
): Promise<{ mine: Record<string, number>; toTake: Record<string, number> }> {
  const { data } = await supabase
    .from("my_open_tasks")
    .select("case_id, assignee_id")
    .or(`assignee_id.eq.${userId},and(kind.eq.question,assignee_id.is.null)`)
    .limit(5000);
  const mine: Record<string, number> = {};
  const toTake: Record<string, number> = {};
  for (const r of data ?? []) {
    const id = r.case_id as string | null;
    if (!id) continue;
    const bucket = r.assignee_id === userId ? mine : toTake;
    bucket[id] = (bucket[id] ?? 0) + 1;
  }
  return { mine, toTake };
}

/**
 * Assigns a question. Deliberately leaves `md_synced_at` alone: the assignment is not
 * part of the deal's 00_README.md, so it must not hold the question back at the next sync.
 */
export async function assignQuestion(id: string, assignee: string | null, due?: string | null) {
  const patch: Record<string, unknown> = { assignee_id: assignee };
  if (due !== undefined) patch.due_date = due;
  return supabase.from("case_questions").update(patch).eq("id", id);
}

/** Assigns a document through the database function (it only touches the assignment columns). */
export async function assignDocument(
  caseId: string,
  type: string,
  assignee: string | null,
  due: string | null = null,
  roundId: string | null = null
) {
  return supabase.rpc("assign_document", {
    p_case_id: caseId,
    p_type: type,
    p_assignee: assignee,
    p_due: due,
    p_round_id: roundId,
  });
}

export function isOverdue(due: string | null): boolean {
  return Boolean(due) && due! < new Date().toISOString().slice(0, 10);
}
