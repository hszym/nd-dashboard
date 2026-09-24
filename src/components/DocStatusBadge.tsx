import { DocumentStatus } from "@/lib/supabase";

const STYLES: Record<DocumentStatus, string> = {
  Missing: "bg-red-50 text-red-700 ring-red-600/20",
  "In Progress": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Done: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export default function DocStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
