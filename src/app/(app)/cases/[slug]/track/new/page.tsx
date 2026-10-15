"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  supabase,
  Case,
  NdaCounterpartyType,
  LP_STATUSES,
  LpStatus,
  Tier,
  TIERS,
} from "@/lib/supabase";

export default function AddLpPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [counterpartyType, setCounterpartyType] =
    useState<NdaCounterpartyType>("company");

  const [lpStatus, setLpStatus] = useState<LpStatus>("Contacted");
  const [tier, setTier] = useState<Tier | "">("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [legalForm, setLegalForm] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [registrationAgency, setRegistrationAgency] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [representativePosition, setRepresentativePosition] = useState("");
  const [representativeName2, setRepresentativeName2] = useState("");
  const [representativePosition2, setRepresentativePosition2] = useState("");

  const [email, setEmail] = useState("");
  const [signingPlace, setSigningPlace] = useState("Luxembourg");
  const [signingDate, setSigningDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("cases")
      .select("*")
      .eq("slug", params.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setCaseData(data as Case);
        else setNotFound(true);
      });
    return () => {
      active = false;
    };
  }, [params.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseData) return;
    if (tier === "") {
      setError("Pick a tier.");
      return;
    }
    if (counterpartyType === "individual" && !firstName.trim() && !lastName.trim()) {
      setError("Enter the LP's name.");
      return;
    }
    if (counterpartyType === "company" && !companyName.trim()) {
      setError("Enter the LP's company name.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: inserted, error: insertError } = await supabase
      .from("ndas")
      .insert({
        case_id: caseData.id,
        counterparty_type: counterpartyType,
        lp_status: lpStatus,
        tier,
        first_name: counterpartyType === "individual" ? firstName.trim() || null : null,
        last_name: counterpartyType === "individual" ? lastName.trim() || null : null,
        company_name: counterpartyType === "company" ? companyName.trim() || null : null,
        legal_form: counterpartyType === "company" ? legalForm.trim() || null : null,
        jurisdiction: counterpartyType === "company" ? jurisdiction.trim() || null : null,
        place_address: counterpartyType === "company" ? placeAddress.trim() || null : null,
        registration_agency:
          counterpartyType === "company" ? registrationAgency.trim() || null : null,
        registration_number:
          counterpartyType === "company" ? registrationNumber.trim() || null : null,
        tax_id: counterpartyType === "company" ? taxId.trim() || null : null,
        representative_name: representativeName.trim() || null,
        representative_position: representativePosition.trim() || null,
        representative_name_2: representativeName2.trim() || null,
        representative_position_2: representativePosition2.trim() || null,
        email: email.trim() || null,
        signing_place: signingPlace.trim() || "Luxembourg",
        signing_date: signingDate,
        status: "Draft",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setSaving(false);
      setError(insertError?.message ?? "Could not add the LP.");
      return;
    }

    // Render and cache the PDF non-admins will download. Best-effort: a
    // failure here doesn't block creation — the download route falls back
    // to generating it on first request instead.
    try {
      await fetch("/api/ndas/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inserted.id }),
      });
    } catch {
      // Ignored — see comment above.
    }

    setSaving(false);
    router.push(`/cases/${caseData.slug}?tab=track`);
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Project not found.</p>
        <Link href="/" className="mt-2 inline-block text-sm text-slate-900 underline">
          Back to projects
        </Link>
      </div>
    );
  }
  if (!caseData) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <Link
        href={`/cases/${caseData.slug}?tab=track`}
        className="text-sm text-slate-500 hover:text-slate-900"
      >
        ← {caseData.name}
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">Add LP</h1>
      <p className="mt-1 text-sm text-slate-500">
        Adds an LP to {caseData.name} and creates their NDA.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tier *">
            <select
              className="input"
              value={tier}
              onChange={(e) =>
                setTier(e.target.value ? (Number(e.target.value) as Tier) : "")
              }
            >
              <option value="">Select a tier…</option>
              {TIERS.map((t) => (
                <option key={t.value} value={t.value} title={t.description}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={lpStatus}
              onChange={(e) => setLpStatus(e.target.value as LpStatus)}
            >
              {LP_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="LP type">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={counterpartyType === "company"}
                onChange={() => setCounterpartyType("company")}
              />
              Company
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={counterpartyType === "individual"}
                onChange={() => setCounterpartyType("individual")}
              />
              Individual
            </label>
          </div>
        </Field>

        {counterpartyType === "individual" ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="First name">
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name">
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
        ) : (
          <>
            <Field label="Company name">
              <input
                className="input"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Holdings SA"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Legal form">
                <input
                  className="input"
                  value={legalForm}
                  onChange={(e) => setLegalForm(e.target.value)}
                  placeholder="société anonyme"
                />
              </Field>
              <Field label="Jurisdiction">
                <input
                  className="input"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  placeholder="Luxembourg"
                />
              </Field>
            </div>
            <Field label="Registered address">
              <input
                className="input"
                value={placeAddress}
                onChange={(e) => setPlaceAddress(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Registration agency">
                <input
                  className="input"
                  value={registrationAgency}
                  onChange={(e) => setRegistrationAgency(e.target.value)}
                  placeholder="RCS Luxembourg"
                />
              </Field>
              <Field label="Registration number">
                <input
                  className="input"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </Field>
              <Field label="Tax ID">
                <input
                  className="input"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Representative name">
            <input
              className="input"
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
            />
          </Field>
          <Field label="Representative position">
            <input
              className="input"
              value={representativePosition}
              onChange={(e) => setRepresentativePosition(e.target.value)}
            />
          </Field>
        </div>

        {counterpartyType === "company" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Second representative name (optional)">
              <input
                className="input"
                value={representativeName2}
                onChange={(e) => setRepresentativeName2(e.target.value)}
                placeholder="Only if this deal needs a second signatory"
              />
            </Field>
            <Field label="Second representative position (optional)">
              <input
                className="input"
                value={representativePosition2}
                onChange={(e) => setRepresentativePosition2(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Signing place">
            <input
              className="input"
              value={signingPlace}
              onChange={(e) => setSigningPlace(e.target.value)}
            />
          </Field>
          <Field label="Signing date">
            <input
              className="input"
              type="date"
              value={signingDate}
              onChange={(e) => setSigningDate(e.target.value)}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add LP"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
