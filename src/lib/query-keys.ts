export const qk = {
  me: ["me"] as const,
  players: {
    all: ["players"] as const,
    list: ["players"] as const,
    squad: ["squad-with-quartile"] as const,
    detail: (id: string) => ["player", id] as const,
    notes: (playerId: string) => ["player-notes", playerId] as const,
    skillRatings: (playerId: string) => ["player-skill-ratings", playerId] as const,
    potdCount: (playerId: string) => ["player-potd-count", playerId] as const,
  },
  coaches: { all: ["coaches"] as const, list: ["coaches"] as const },
  sessions: {
    all: ["sessions"] as const,
    list: ["all-sessions"] as const,
    matchList: ["match-sessions"] as const,
    detail: (id: string) => ["session", id] as const,
    matchSummary: (sessionId: string) => ["match-summary", sessionId] as const,
    completion: {
      all: ["match-completion"] as const,
      detail: (sessionId: string | null) => ["match-completion", sessionId] as const,
    },
  },
  match: {
    teamsForSession: (sessionId: string) => ["match-teams", sessionId] as const,
    builderData: (sessionId: string) => ["match-team-builder", sessionId] as const,
    context: (sessionId: string, teamId: string) => ["match-ctx", sessionId, teamId] as const,
  },
  feed: {
    all: ["feed"] as const,
    list: ["feed"] as const,
    homeSummary: ["home-summary"] as const,
  },
  auditLog: ["audit-log"] as const,
} as const;
