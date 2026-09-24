import { Stage } from "@/lib/supabase";

const STYLES: Record<Stage, string> = {
  "Under Review": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Raising: "bg-blue-50 text-blue-700 ring-blue-700/20",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export default function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[stage]}`}
    >
      {stage}
    </span>
  );
}
