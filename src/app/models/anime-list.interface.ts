// ─────────────────────────────────────────────────────────────
// anime.interface.ts
// Interfaces for Tenrai API list payloads and swipe genre scores.
// ─────────────────────────────────────────────────────────────
import { Anime } from '@tutkli/jikan-ts';

// ── Paginated result returned by TenraiService ────────────────

/**
 * Normalized structure for all TenraiService list responses.
 * Avoids direct use of raw upstream API envelopes.
 */
export interface AnimeListResult {
  /** Anime array returned for the current page. */
  data: Anime[];
  /** Whether another page is available. */
  hasNextPage: boolean;
  /** Current page number. */
  currentPage: number;
  /** Total number of results across all pages. */
  total: number;
}

// ── Genre scores used by the Swipe system ──────────────────

/**
 * Maps a MAL genre id to an affinity score.
 * Persisted in LocalStorage under 'anime-cat-genre-scores'.
 * Positive = user likes this genre, negative = user dislikes it.
 */
export type GenreScoreMap = Record<number, number>;
