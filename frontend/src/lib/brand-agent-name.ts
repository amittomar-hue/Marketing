"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dmoop_brand_agent_name";
const DEFAULT_NAME = "Brand Agent";

export function useBrandAgentName(): [string, (name: string) => void] {
  const [name, setNameState] = useState<string>(DEFAULT_NAME);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) setNameState(stored.trim());
  }, []);

  const setName = (val: string) => {
    const trimmed = val.trim().slice(0, 40);
    const final = trimmed || DEFAULT_NAME;
    setNameState(final);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, final);
    }
  };

  return [name, setName];
}

export function getBrandAgentName(): string {
  if (typeof window === "undefined") return DEFAULT_NAME;
  return localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_NAME;
}
