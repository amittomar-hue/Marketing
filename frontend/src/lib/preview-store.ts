"use client";

import { create } from "zustand";
import type { PreviewKind } from "./preview-detect";

// ─────────────────────────────────────────────────────────────────
// Global state for the code-preview drawer. Any code block in any
// message can call openPreview() to push its content into the drawer.
// Only one artifact is visible at a time — the drawer replaces.
// ─────────────────────────────────────────────────────────────────

export interface PreviewArtifact {
  kind: PreviewKind;
  language: string;
  code: string;
  /** Optional label shown in the drawer header — defaults to the language. */
  title?: string;
}

interface PreviewStore {
  artifact: PreviewArtifact | null;
  openPreview: (a: PreviewArtifact) => void;
  closePreview: () => void;
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  artifact: null,
  openPreview: (artifact) => set({ artifact }),
  closePreview: () => set({ artifact: null }),
}));
