import { supabase } from "@/lib/supabase";

export interface Workspace { id: string; name: string }
export interface Project { id: string; name: string; sort: number }
export interface Topic { id: string; name: string; color: string | null; sort: number }
export interface Status { id: string; name: string; color: string | null; sort: number; is_done: boolean; is_active: boolean }
export interface Item {
  id: string;
  project_id: string;
  topic_id: string | null;
  status_id: string | null;
  details: string;
  priority: "High" | "Medium" | "Low" | null;
  urgency: number | null;
  responsible: string | null;
  /** Account of the person it is assigned to (counts in their tasks); `responsible` stays free text. */
  assignee_id: string | null;
  last_feedback: string | null;
  feedback_result: string | null;
  pending_with: string | null;
  start_date: string | null;
  due_date: string | null;
  flag: boolean | null;
  sort: number;
}
export interface TrackerEvent {
  id: string;
  item_id: string;
  source: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  note: string | null;
  created_at: string;
}
export interface TrackerData {
  projects: Project[];
  topics: Topic[];
  statuses: Status[];
  items: Item[];
}

/** A deal's tracker: its sub-projects (tracker_projects.case_id = the deal) and their to-dos. */
export async function loadWorkspace(workspaceId: string, caseId: string): Promise<TrackerData> {
  const [projects, topics, statuses] = await Promise.all([
    supabase.from("tracker_projects").select("id,name,sort").eq("workspace_id", workspaceId).eq("case_id", caseId).order("sort"),
    supabase.from("tracker_topics").select("id,name,color,sort").eq("workspace_id", workspaceId).order("sort"),
    supabase.from("tracker_statuses").select("id,name,color,sort,is_done,is_active").eq("workspace_id", workspaceId).order("sort"),
  ]);
  const projectIds = (projects.data ?? []).map((p) => p.id);
  const items = projectIds.length
    ? await supabase.from("tracker_items").select("*").in("project_id", projectIds).order("sort").limit(5000)
    : { data: [] as Item[] };
  return {
    projects: projects.data ?? [],
    topics: topics.data ?? [],
    statuses: statuses.data ?? [],
    items: (items.data ?? []) as Item[],
  };
}

const EDITABLE: (keyof Item)[] = [
  "topic_id", "status_id", "details", "priority", "urgency", "responsible", "assignee_id", "last_feedback",
  "feedback_result", "pending_with", "start_date", "due_date", "flag",
];

/** Saves a patch on an item and logs what changed in tracker_events. */
export async function saveItem(before: Item, patch: Partial<Item>, note?: string): Promise<Item | null> {
  const changes: TrackerEvent["changes"] = {};
  for (const k of EDITABLE) {
    if (k in patch && patch[k] !== before[k]) changes[k] = { from: before[k], to: patch[k] };
  }
  if (!Object.keys(changes).length && !note) return before;
  const { data, error } = await supabase.from("tracker_items").update(patch).eq("id", before.id).select("*").single();
  if (error || !data) return null;
  await supabase.from("tracker_events").insert({ item_id: before.id, source: "manual", changes, note: note ?? null });
  return data as Item;
}

export async function createItem(projectId: string, details: string, statusId: string | null): Promise<Item | null> {
  const { data, error } = await supabase
    .from("tracker_items")
    .insert({ project_id: projectId, details, status_id: statusId })
    .select("*")
    .single();
  if (error || !data) return null;
  await supabase.from("tracker_events").insert({ item_id: data.id, source: "manual", changes: {}, note: "Created" });
  return data as Item;
}

/** Adds a sub-project to a deal's tracker. */
export async function createProject(
  workspaceId: string,
  caseId: string,
  name: string,
  sort: number
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("tracker_projects")
    .insert({ workspace_id: workspaceId, case_id: caseId, name, sort })
    .select("id,name,sort")
    .single();
  return error || !data ? null : (data as Project);
}

export async function loadEvents(itemId: string): Promise<TrackerEvent[]> {
  const { data } = await supabase
    .from("tracker_events")
    .select("id,item_id,source,changes,note,created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TrackerEvent[];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(item: Item, statuses: Status[]): boolean {
  if (!item.due_date) return false;
  const st = statuses.find((s) => s.id === item.status_id);
  return !st?.is_done && item.due_date < todayISO();
}
