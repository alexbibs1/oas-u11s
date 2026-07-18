// Central query-key registry. Importing these instead of inline string
// literals means (a) invalidations can't drift out of sync with the
// original queryKey, and (b) IDE go-to-definition works on query keys.
//
// Convention: each entity has an object with `all` (for invalidate-all),
// `lists` (collection queries), and `detail(id)` (single-record queries).
// Partial keys can be passed to invalidateQueries to match a prefix:
//   qc.invalidateQueries({ queryKey: qk.blocks.all })         // everything block-related
//   qc.invalidateQueries({ queryKey: qk.blocks.detail(id) })  // one block

export const qk = {
  me: ["me"] as const,

  players: {
    all: ["players"] as const,
    list: ["players"] as const,
    detail: (id: string) => ["player", id] as const,
    notes: (playerId: string) => ["player-notes", playerId] as const,
    currentBlock: (playerId: string) => ["player-current-block", playerId] as const,
    skillRatings: (playerId: string) => ["player-skill-ratings", playerId] as const,
  },

  coaches: {
    all: ["coaches"] as const,
    list: ["coaches"] as const,
  },

  blocks: {
    all: ["blocks"] as const,
    list: ["blocks"] as const,
    meta: ["blocks-meta"] as const,
    detail: (id: string | null) => ["block-builder", id] as const,
  },

  sessions: {
    all: ["sessions"] as const,
    list: ["all-sessions"] as const,
    matchList: ["match-sessions"] as const,
    detail: (id: string) => ["session", id] as const,
    matchSummary: (sessionId: string) => ["match-summary", sessionId] as const,
    matchWeeks: ["match-weeks"] as const,
    weekCompletion: {
      // Use `all` for prefix invalidation (matches any sessionId),
      // `detail(sessionId)` for a specific entry.
      all: ["week-completion"] as const,
      detail: (sessionId: string | null) => ["week-completion", sessionId] as const,
    },
  },

  groups: {
    forBlock: (blockId: string) => ["groups", blockId] as const,
    myForWeek: (sessionId: string) => ["my-groups-week", sessionId] as const,
    rosterForWeek: (sessionId: string, groupId: string) =>
      ["group-roster-week", sessionId, groupId] as const,
  },

  match: {
    context: (sessionId: string, groupId: string) => ["match-ctx", sessionId, groupId] as const,
  },

  feed: {
    all: ["feed"] as const,
    list: ["feed"] as const,
    homeSummary: ["home-summary"] as const,
  },

  auditLog: ["audit-log"] as const,
} as const;
