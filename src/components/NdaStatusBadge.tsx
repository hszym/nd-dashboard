import { NdaStatus } from "@/lib/supabase";

const STYLES: Record<NdaStatus, string> = {
  Draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  Sent: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Signed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export default function NdaStatusBadge({ status }: { status: NdaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
