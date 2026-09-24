"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, Case, NdaCounterpartyType } from "@/lib/supabase";

export default function NewNdaPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [caseId, setCaseId] = useState("");
  const [counterpartyType, setCounterpartyType] =
    useState<NdaCounterpartyType>("company");

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
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setCases((data as Case[]) ?? []);
        if (data && data.length > 0) setCaseId(data[0].id);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId) {
      setError("Pick a project.");
      return;
    }
    if (counterpartyType === "individual" && !firstName.trim() && !lastName.trim()) {
      setError("Enter the counterparty's name.");
      return;
    }
    if (counterpartyType === "company" && !companyName.trim()) {
      setError("Enter the counterparty's company name.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("ndas").insert({
      case_id: caseId,
      counterparty_type: counterpartyType,
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
      email: email.trim() || null,
      signing_place: signingPlace.trim() || "Luxembourg",
      signing_date: signingDate,
      status: "Draft",
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/ndas");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">New NDA</h1>
      <p className="mt-1 text-sm text-slate-500">
        Creates a tracked NDA for a project&apos;s counterparty.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Field label="Project *">
          <select
            className="input"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
          >
            {cases.length === 0 && <option value="">No projects yet</option>}
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Counterparty type">
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
            {saving ? "Creating…" : "Create NDA"}
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
