import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { getMyRole } from "./roles.functions";
import { qk } from "@/lib/query-keys";

const KEY = "oa-view-as-coach";
const EVENT = "oa-view-as-change";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useViewAsCoach(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setViewAsCoach(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function useMyRole() {
  const query = useQuery({
    queryKey: qk.me,
    queryFn: () => getMyRole(),
    staleTime: 60_000,
  });
  const viewAsCoach = useViewAsCoach();
  const real = query.data;
  const canToggle = !!real?.isBlockBuilder;
  const effective = real
    ? viewAsCoach && canToggle
      ? { ...real, isBlockBuilder: false, isCoach: true, roles: ["coach"] }
      : real
    : real;
  return { ...query, data: effective, realIsBlockBuilder: canToggle, viewAsCoach };
}
