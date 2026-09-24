"use client";

import { useEffect, useState } from "react";
import { ROLE_COOKIE, Role, isValidRole } from "@/lib/auth";

/**
 * Reads the role cookie on the client. Returns `undefined` while it hasn't
 * been read yet (first paint), then "admin" | "team". Middleware already
 * guarantees a valid cookie is present for any page this hook runs on, but
 * we fall back to the least-privileged role ("team") just in case.
 */
export function useRole(): Role | undefined {
  const [role, setRole] = useState<Role | undefined>(undefined);

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`${ROLE_COOKIE}=([^;]+)`));
    const value = match?.[1];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read auth cookie on mount
    setRole(isValidRole(value) ? value : "team");
  }, []);

  return role;
}
