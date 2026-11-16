"use client";

import type { TeamMember } from "@/lib/tasks";

/** Picks who a task goes to (team directory). Empty value = nobody. */
export default function AssigneeSelect({
  team,
  value,
  onChange,
  emptyLabel = "Unassigned",
  className = "",
  disabled,
}: {
  team: TeamMember[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none disabled:opacity-50 ${className}`}
    >
      <option value="">{emptyLabel}</option>
      {team.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}
