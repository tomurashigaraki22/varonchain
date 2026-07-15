"use client";

import { useEffect, useState } from "react";

export type ActivationStatus = "checking" | "activated" | "inactive";

/**
 * Checks the httpOnly cookie-based activation status on mount.
 * Returns "checking" until the server responds, then "activated" or "inactive".
 */
export function useActivationStatus() {
  const [status, setStatus] = useState<ActivationStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/txline/status")
      .then((r) => r.json())
      .then((data: { activated: boolean }) => {
        if (!cancelled) setStatus(data.activated ? "activated" : "inactive");
      })
      .catch(() => {
        if (!cancelled) setStatus("inactive");
      });
    return () => { cancelled = true; };
  }, []);

  return status;
}
