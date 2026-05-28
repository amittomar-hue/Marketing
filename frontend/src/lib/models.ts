export type ModelId =
  | "marketing-opus-4"
  | "marketing-sonnet-4"
  | "marketing-haiku-4";

export interface Model {
  id: ModelId;
  name: string;
  label: string;
  description: string;
  badge?: string;
  speed: "Fast" | "Balanced" | "Powerful";
  color: string;
}

export const MODELS: Model[] = [
  {
    id: "marketing-opus-4",
    name: "Marketing Opus",
    label: "Marketing Opus 4",
    description: "Most capable. Deep campaign strategy, competitive analysis, complex multi-channel briefs.",
    badge: "Most capable",
    speed: "Powerful",
    color: "text-violet-600",
  },
  {
    id: "marketing-sonnet-4",
    name: "Marketing Sonnet",
    label: "Marketing Sonnet 4",
    description: "Best balance of intelligence and speed. Ideal for daily content generation and trend analysis.",
    badge: "Recommended",
    speed: "Balanced",
    color: "text-blue-600",
  },
  {
    id: "marketing-haiku-4",
    name: "Marketing Haiku",
    label: "Marketing Haiku 4",
    description: "Fastest model. Quick ad copy, subject lines, and social posts in under 2 seconds.",
    speed: "Fast",
    color: "text-emerald-600",
  },
];

export const DEFAULT_MODEL: ModelId = "marketing-sonnet-4";

export function getModel(id: ModelId): Model {
  return MODELS.find((m) => m.id === id) ?? MODELS[1];
}
