import { groupingInfo } from "@/lib/groupings";

/** Small neutral badge showing a player's Grouping (1+ to 4). Renders nothing when unassigned. */
export function GroupingBadge({
  value,
  className = "",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const info = groupingInfo(value);
  if (!info) return null;
  return (
    <span
      title={`${info.group}: ${info.band}. ${info.note}`}
      className={`ml-1 rounded border bg-muted px-1 py-0.5 text-[9px] font-bold tabular-nums text-foreground ${className}`}
    >
      {info.value}
    </span>
  );
}
