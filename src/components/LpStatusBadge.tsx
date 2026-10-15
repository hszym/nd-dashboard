import { LpStatus } from "@/lib/supabase";

const STYLES: Record<LpStatus, string> = {
  Contacted: "bg-slate-100 text-slate-600 ring-slate-500/20",
  Interested: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Declined: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function LpStatusBadge({ status }: { status: LpStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
