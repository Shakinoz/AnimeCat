// ─────────────────────────────────────────────────────────────
// anime.interface.ts
// Interfaces liées aux résultats et paramètres de l'API Tenrai.
// ─────────────────────────────────────────────────────────────
import { Anime } from '@tutkli/jikan-ts';

// ── Résultat paginé renvoyé par TenraiService ────────────────

/**
 * Format normalisé de toutes les réponses listes de TenraiService.
 * Évite de manipuler directement l'enveloppe brute de l'API.
 */
export interface AnimeListResult {
  /** Tableau d'animés reçus pour la page courante. */
  data: Anime[];
  /** Indique s'il existe une page suivante. */
  hasNextPage: boolean;
  /** Numéro de la page actuellement chargée. */
  currentPage: number;
  /** Nombre total de résultats (toutes pages). */
  total: number;
}

// ── Paramètres de recherche avancée ──────────────────────────
// ── Scores des genres pour le système Swipe ──────────────────

/**
 * Mappe un identifiant de genre MAL à un score d'affinité.
 * Stocké dans le LocalStorage sous la clé 'anime-cat-genre-scores'.
 * Positif = l'utilisateur aime ce genre, négatif = non aimé.
 */
export type GenreScoreMap = Record<number, number>;
