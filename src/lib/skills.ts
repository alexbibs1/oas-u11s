// Shared skill + attribute definitions. Order matters and must match the UX spec.

export const SKILLS = [
  { key: "carrying", label: "Carrying", short: "Car" },
  { key: "handling", label: "Handling", short: "Han" },
  { key: "tackling", label: "Tackling", short: "Tac" },
  { key: "rucking", label: "Rucking", short: "Ruc" },
  { key: "kicking", label: "Kicking", short: "Kic" },
  { key: "catching", label: "Catching", short: "Cat" },
  { key: "iq", label: "IQ", short: "IQ" },
] as const;

export type SkillKey = (typeof SKILLS)[number]["key"];
export const SKILL_KEYS = SKILLS.map((s) => s.key) as SkillKey[];

export const ATTRIBUTES = [
  { key: "speed", label: "Speed", short: "Spd" },
  { key: "strength", label: "Strength", short: "Str" },
  { key: "repeatability", label: "Repeatability", short: "Rep" },
] as const;

export type AttributeKey = (typeof ATTRIBUTES)[number]["key"];
export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key) as AttributeKey[];

export const SKILL_DESCRIPTORS: Record<number, string> = {
  1: "Not yet engaging",
  2: "Developing, needs support",
  3: "Exactly where we expect",
  4: "Above expectations, consistently good",
  5: "Top 5 in the squad",
};

export const REPEATABILITY_DESCRIPTORS: Record<number, string> = {
  1: "Needs regular breaks",
  2: "Tires, recovers with rest",
  3: "Goes most of the session",
  4: "Stays strong throughout",
  5: "Full effort, every time",
};
