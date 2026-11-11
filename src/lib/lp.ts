import type { NdaCounterpartyType } from "@/lib/supabase";

/** Everything the LP-details form collects (shared by the admin page and the public form). */
export interface LpValues {
  counterpartyType: NdaCounterpartyType;
  firstName: string;
  lastName: string;
  companyName: string;
  legalForm: string;
  jurisdiction: string;
  placeAddress: string;
  registrationAgency: string;
  registrationNumber: string;
  taxId: string;
  representativeName: string;
  representativePosition: string;
  representativeName2: string;
  representativePosition2: string;
  email: string;
}

export const emptyLpValues: LpValues = {
  counterpartyType: "company",
  firstName: "",
  lastName: "",
  companyName: "",
  legalForm: "",
  jurisdiction: "",
  placeAddress: "",
  registrationAgency: "",
  registrationNumber: "",
  taxId: "",
  representativeName: "",
  representativePosition: "",
  representativeName2: "",
  representativePosition2: "",
  email: "",
};

const MAX_FIELD_LENGTH = 300;

/** Trims every field and caps its length. Run on anything that came from a public form. */
export function sanitizeLpValues(input: unknown): LpValues {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const clean = (key: keyof LpValues): string => {
    const v = src[key];
    return typeof v === "string" ? v.trim().slice(0, MAX_FIELD_LENGTH) : "";
  };
  return {
    counterpartyType: src.counterpartyType === "individual" ? "individual" : "company",
    firstName: clean("firstName"),
    lastName: clean("lastName"),
    companyName: clean("companyName"),
    legalForm: clean("legalForm"),
    jurisdiction: clean("jurisdiction"),
    placeAddress: clean("placeAddress"),
    registrationAgency: clean("registrationAgency"),
    registrationNumber: clean("registrationNumber"),
    taxId: clean("taxId"),
    representativeName: clean("representativeName"),
    representativePosition: clean("representativePosition"),
    representativeName2: clean("representativeName2"),
    representativePosition2: clean("representativePosition2"),
    email: clean("email"),
  };
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Returns an error message, or null when OK. `strict` is for the public form,
 * where the LP must give everything the NDA needs; the admin page only needs a name.
 */
export function validateLp(v: LpValues, strict: boolean): string | null {
  if (v.counterpartyType === "individual") {
    if (!v.firstName && !v.lastName) return "Please enter your name.";
  } else if (!v.companyName) {
    return "Please enter the company name.";
  }
  if (v.email && !isEmail(v.email)) return "That email address doesn't look right.";
  if (!strict) return null;

  if (!v.email) return "Please enter an email address.";
  if (v.counterpartyType === "individual") {
    if (!v.firstName || !v.lastName) return "Please enter your first and last name.";
    if (!v.placeAddress) return "Please enter your address.";
    return null;
  }
  const required: [string, string][] = [
    [v.legalForm, "legal form"],
    [v.jurisdiction, "jurisdiction"],
    [v.placeAddress, "registered address"],
    [v.registrationAgency, "registration agency"],
    [v.registrationNumber, "registration number"],
    [v.representativeName, "signatory name"],
    [v.representativePosition, "signatory position"],
  ];
  for (const [value, label] of required) {
    if (!value) return `Please fill in the ${label}.`;
  }
  return null;
}

/** Maps the form to `ndas` columns, nulling company-only fields for individuals. The address is kept for both. */
export function lpValuesToRow(v: LpValues) {
  const company = v.counterpartyType === "company";
  const individual = v.counterpartyType === "individual";
  return {
    counterparty_type: v.counterpartyType,
    first_name: individual ? v.firstName || null : null,
    last_name: individual ? v.lastName || null : null,
    company_name: company ? v.companyName || null : null,
    legal_form: company ? v.legalForm || null : null,
    jurisdiction: company ? v.jurisdiction || null : null,
    place_address: v.placeAddress || null,
    registration_agency: company ? v.registrationAgency || null : null,
    registration_number: company ? v.registrationNumber || null : null,
    tax_id: company ? v.taxId || null : null,
    representative_name: v.representativeName || null,
    representative_position: v.representativePosition || null,
    representative_name_2: company ? v.representativeName2 || null : null,
    representative_position_2: company ? v.representativePosition2 || null : null,
    email: v.email || null,
  };
}
