import { GROUPINGS } from "@/lib/groupings";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Grouping picker with the head coach's band labels as section headers. */
export function GroupingSelect({
  value,
  onChange,
  disabled,
  className = "h-8 w-28 text-xs",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const bands = [...new Set(GROUPINGS.map((g) => g.group))];
  return (
    <Select
      value={value ?? "unassigned"}
      onValueChange={(v) => onChange(v === "unassigned" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue>{value ?? "Unassigned"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {bands.map((band) => {
          const items = GROUPINGS.filter((g) => g.group === band);
          return (
            <SelectGroup key={band}>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {band} · {items[0].band}
              </SelectLabel>
              {items.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  <span className="font-semibold tabular-nums">{g.value}</span>
                  {g.note !== g.band && (
                    <span className="ml-2 text-xs text-muted-foreground">{g.note}</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
