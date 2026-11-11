"use client";

import { useState } from "react";
import { LpValues } from "@/lib/lp";

/** Soft white card that groups related fields. */
export function LpSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.3)] sm:p-6">
      <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function LpField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
        {required && <span className="text-slate-400"> *</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * The LP-details sections (type, identity, signatory, contact). Used by the
 * admin Add LP page and the public request form. `strict` marks fields the
 * public form requires.
 */
export default function LpFields({
  values,
  onChange,
  strict,
}: {
  values: LpValues;
  onChange: (next: LpValues) => void;
  strict: boolean;
}) {
  const set = <K extends keyof LpValues>(key: K, value: LpValues[K]) =>
    onChange({ ...values, [key]: value });

  const isCompany = values.counterpartyType === "company";
  const [showSecond, setShowSecond] = useState(
    Boolean(values.representativeName2 || values.representativePosition2)
  );

  return (
    <>
      <LpSection title="Who is the LP?">
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
          {(["company", "individual"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("counterpartyType", t)}
              className={`rounded-full px-5 py-1.5 font-medium capitalize transition-colors ${
                values.counterpartyType === t
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </LpSection>

      {isCompany ? (
        <LpSection title="Company details">
          <LpField label="Company name" required>
            <input
              className="input"
              value={values.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Acme Holdings SA"
            />
          </LpField>
          <div className="grid gap-4 sm:grid-cols-2">
            <LpField label="Legal form" required={strict}>
              <input
                className="input"
                value={values.legalForm}
                onChange={(e) => set("legalForm", e.target.value)}
                placeholder="société anonyme"
              />
            </LpField>
            <LpField label="Jurisdiction" required={strict}>
              <input
                className="input"
                value={values.jurisdiction}
                onChange={(e) => set("jurisdiction", e.target.value)}
                placeholder="Luxembourg"
              />
            </LpField>
          </div>
          <LpField label="Registered address" required={strict}>
            <input
              className="input"
              value={values.placeAddress}
              onChange={(e) => set("placeAddress", e.target.value)}
            />
          </LpField>
          <div className="grid gap-4 sm:grid-cols-3">
            <LpField label="Registration agency" required={strict}>
              <input
                className="input"
                value={values.registrationAgency}
                onChange={(e) => set("registrationAgency", e.target.value)}
                placeholder="RCS Luxembourg"
              />
            </LpField>
            <LpField label="Registration number" required={strict}>
              <input
                className="input"
                value={values.registrationNumber}
                onChange={(e) => set("registrationNumber", e.target.value)}
              />
            </LpField>
            <LpField label="Tax ID">
              <input
                className="input"
                value={values.taxId}
                onChange={(e) => set("taxId", e.target.value)}
              />
            </LpField>
          </div>
        </LpSection>
      ) : (
        <LpSection title="Your name">
          <div className="grid gap-4 sm:grid-cols-2">
            <LpField label="First name" required={strict}>
              <input
                className="input"
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </LpField>
            <LpField label="Last name" required={strict}>
              <input
                className="input"
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </LpField>
          </div>
        </LpSection>
      )}

      <LpSection
        title={isCompany ? "Signatory" : "Representative"}
        hint={
          isCompany
            ? "The person who signs the NDA for the company."
            : "Only if someone else signs on your behalf."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LpField label="Name" required={strict && isCompany}>
            <input
              className="input"
              value={values.representativeName}
              onChange={(e) => set("representativeName", e.target.value)}
            />
          </LpField>
          <LpField label="Position" required={strict && isCompany}>
            <input
              className="input"
              value={values.representativePosition}
              onChange={(e) => set("representativePosition", e.target.value)}
              placeholder="Director"
            />
          </LpField>
        </div>

        {isCompany &&
          (showSecond ? (
            <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Second signatory
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...values,
                      representativeName2: "",
                      representativePosition2: "",
                    });
                    setShowSecond(false);
                  }}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <LpField label="Name">
                  <input
                    className="input"
                    value={values.representativeName2}
                    onChange={(e) => set("representativeName2", e.target.value)}
                  />
                </LpField>
                <LpField label="Position">
                  <input
                    className="input"
                    value={values.representativePosition2}
                    onChange={(e) => set("representativePosition2", e.target.value)}
                  />
                </LpField>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecond(true)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              + Add a second signatory
            </button>
          ))}
      </LpSection>

      <LpSection title="Contact">
        <LpField label="Email" required={strict}>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </LpField>
      </LpSection>
    </>
  );
}
