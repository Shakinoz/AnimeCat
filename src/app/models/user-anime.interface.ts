// ─────────────────────────────────────────────────────────────
// user-anime.interface.ts
// Models for user-specific anime state management.
// ─────────────────────────────────────────────────────────────
import { Anime } from '@tutkli/jikan-ts';

// ── Anime status values in user list ────────

/**
 * Available anime states for a user.
 * - plan_to_watch : in watchlist
 * - seen          : marked as completed
 * - watching      : currently watching (reserved for future use)
 */
export type AnimeStatus = 'watching' | 'seen' | 'plan_to_watch';

// ── Entry in a user's anime list ────────────────────

/** Links a MAL anime ID with a user status. */
export interface IUserAnime {
  animeId: number;
  status: AnimeStatus;
  /** Optional personal score. */
  score?: number;
  /** Optional favorite flag. */
  favorite?: boolean;
}

// ── Tier list ────────────────────────────────────────────────

/**
 * Stores MAL anime IDs grouped by rank.
 * S = Supreme, A = Excellent, B = Good, C = Average.
 */
export interface ITierList {
  S: number[];
  A: number[];
  B: number[];
  C: number[];
}

// ── Extended type used in Home and Profile ────────────

/**
 * Extends Jikan `Anime` with the current user status.
 * Used wherever cards need to render persisted state.
 */
export interface HomeAnime extends Anime {
  userStatus?: AnimeStatus | null;
}
