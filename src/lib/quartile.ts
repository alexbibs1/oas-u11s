// Shared squad-wide quartile ranking. This is the only ranking regular
// coaches ever see — tiers (Developing/Intermediate/Advanced) are a
// separate, admin-only concept and never feed into this calculation's
// visibility, only its input data.
import { SKILL_KEYS, ATTRIBUTE_KEYS } from "@/lib/skills";

export function computeQuartileMap(
  players: Array<{ id: string; [k: string]: any }>,
): Map<string, number> {
  const allKeys = [...SKILL_KEYS, ...ATTRIBUTE_KEYS] as string[];
  const scored = players.map((p) => {
    const values = allKeys.map((k) => (p as any)[k] as number);
    return { id: p.id, overall: values.reduce((a, b) => a + b, 0) / values.length };
  });
  scored.sort((a, b) => b.overall - a.overall);
  const quartileSize = Math.max(1, Math.ceil(scored.length / 4));
  const map = new Map<string, number>();
  scored.forEach((p, i) => {
    map.set(p.id, Math.min(Math.floor(i / quartileSize) + 1, 4));
  });
  return map;
}
