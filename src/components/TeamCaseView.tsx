import { Case, CaseDocument, isEmailDocumentType } from "@/lib/supabase";
import StageBadge from "./StageBadge";

function isAvailable(doc: CaseDocument): boolean {
  return doc.status === "Done" && Boolean(doc.file_url);
}

export default function TeamCaseView({
  caseData,
  documents,
}: {
  caseData: Case;
  documents: CaseDocument[];
}) {
  const available = documents.filter(isAvailable);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          {caseData.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={caseData.logo_url}
              alt=""
              className="h-10 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {caseData.name}
            </h1>
            {(caseData.sector || caseData.sponsor) && (
              <p className="text-sm text-slate-500">
                {[caseData.sector, caseData.sponsor && `Sponsor: ${caseData.sponsor}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="ml-auto">
            <StageBadge stage={caseData.stage} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Available documents
          </h2>
        </div>
        {available.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            No documents available yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {available.map((doc) => (
              <li
                key={doc.type}
                className="flex items-center justify-between px-6 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">{doc.type}</span>
                <a
                  href={doc.file_url!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {isEmailDocumentType(doc.type) ? "Download ↓" : "Open ↗"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
