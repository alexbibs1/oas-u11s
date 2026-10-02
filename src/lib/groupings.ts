// Player Grouping: the head coach's 1+ to 4 scale. Visible to all coaches,
// never to parents or players. Order matters: it drives every dropdown and sort.

export const GROUPINGS = [
  {
    value: "1+",
    group: "Gp 1",
    band: "Currently best performers",
    note: "Consistent in range of areas",
  },
  {
    value: "1",
    group: "Gp 1",
    band: "Currently best performers",
    note: "Consistent in most areas",
  },
  {
    value: "2+",
    group: "Gp 2",
    band: "The best of the rest",
    note: "Capable of being 1 on their day",
  },
  {
    value: "2",
    group: "Gp 2",
    band: "The best of the rest",
    note: "Real potential, focus on consistency of fundamentals",
  },
  {
    value: "3+",
    group: "Gp 3",
    band: "Major focus required",
    note: "Can have real impact when involved",
  },
  {
    value: "3",
    group: "Gp 3",
    band: "Major focus required",
    note: "Infrequent involvements = infrequent impact",
  },
  { value: "4", group: "Gp 4", band: "Focus group", note: "Focus group" },
] as const;

export type GroupingValue = (typeof GROUPINGS)[number]["value"];
export const GROUPING_VALUES = GROUPINGS.map((g) => g.value) as [GroupingValue, ...GroupingValue[]];

export function groupingInfo(value: string | null | undefined) {
  return GROUPINGS.find((g) => g.value === value) ?? null;
}

/** Sort index: 1+ first, unassigned last. */
export function groupingRank(value: string | null | undefined): number {
  const i = GROUPINGS.findIndex((g) => g.value === value);
  return i === -1 ? GROUPINGS.length : i;
}
