"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Role, getRole } from "@/lib/auth";

/**
 * Reads the signed-in user's role from public.profiles. Returns `undefined`
 * while it hasn't loaded yet (first paint), then "admin" | "team". Middleware
 * already guarantees a signed-in user for any page this hook runs on.
 */
export function useRole(): Role | undefined {
  const [role, setRole] = useState<Role | undefined>(undefined);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const nextRole = await getRole(supabase, user?.id);
      if (active) setRole(nextRole);
    }

    load();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return role;
}
