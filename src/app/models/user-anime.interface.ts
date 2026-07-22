// ─────────────────────────────────────────────────────────────
// user-anime.interface.ts
// Modèles liés à la gestion des animés par l'utilisateur.
// ─────────────────────────────────────────────────────────────
import { Anime } from '@tutkli/jikan-ts';

// ── Statut d'un animé dans la liste de l'utilisateur ────────

/**
 * Les trois états possibles d'un animé pour un utilisateur.
 * - plan_to_watch : dans la watchlist
 * - seen          : marqué comme terminé
 * - watching      : en cours (réservé pour une future évolution)
 */
export type AnimeStatus = 'watching' | 'seen' | 'plan_to_watch';

// ── Entrée dans la liste de l'utilisateur ────────────────────

/** Association entre un identifiant MAL et un statut utilisateur. */
export interface IUserAnime {
  animeId: number;
  status: AnimeStatus;
  /** Note personnelle (optionnelle). */
  score?: number;
  /** Marqué comme favori (optionnel). */
  favorite?: boolean;
}

// ── Tier List ────────────────────────────────────────────────

/**
 * Stocke les identifiants MAL classés par rang.
 * S = Supreme, A = Excellent, B = Bien, C = Correct.
 */
export interface ITierList {
  S: number[];
  A: number[];
  B: number[];
  C: number[];
}

// ── Type étendu utilisé dans la Home et le Profil ────────────

/**
 * Étend le type Anime de Jikan avec le statut de l'utilisateur courant.
 * Utilisé partout où la carte doit afficher l'état (vue, watchlist…).
 */
export interface HomeAnime extends Anime {
  userStatus?: AnimeStatus | null;
}
