import { createFileRoute, redirect } from "@tanstack/react-router";

// Scoring now lives in one flow on Match Day (register, then score).
// Kept so old links and bookmarks still land in the right place.
export const Route = createFileRoute("/_authenticated/ratings")({
  beforeLoad: () => {
    throw redirect({ to: "/match-day", search: { sessionId: undefined, teamId: undefined } });
  },
});
