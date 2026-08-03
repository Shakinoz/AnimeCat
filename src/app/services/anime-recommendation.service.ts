import { Injectable } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { GenreScoreMap } from '../models/anime-list.interface';
import { IUser } from '../models/user.interface';
import { ITierList } from '../models/user-anime.interface';

/**
 * Recommendation category displayed in the UI.
 * - safest_choice : highest compatibility with the current profile
 * - popular_choice: compatible but more mainstream
 * - discovery     : less obvious but still relevant
 */
export type RecommendationType = 'safest_choice' | 'popular_choice' | 'discovery';

/**
 * Genre score ready to display or log.
 * Keeps MAL id for computation and name for UI output.
 */
export interface RankedGenreScore {
  genreId: number;
  genreName: string;
  score: number;
}

/**
 * Final recommendation payload.
 * `matchingGenres` explains why the anime was selected.
 */
export interface AnimeRecommendation {
  anime: Anime;
  type: RecommendationType;
  score: number;
  matchingGenres: string[];
  explanation: string;
}

/**
 * Full recommendation engine output.
 * The three suggestion slots are nullable when the candidate pool is too small.
 */
export interface RecommendationResult {
  safestChoice: AnimeRecommendation | null;
  popularChoice: AnimeRecommendation | null;
  discovery: AnimeRecommendation | null;
  genreScores: RankedGenreScore[];
}

/**
 * Ranked recommendation entry for list/carousel views.
 */
export interface RankedAnimeRecommendation {
  anime: Anime;
  score: number;
  matchingGenres: string[];
  explanation: string;
}

/**
 * Input payload required by the recommendation pipeline.
 * Reuses existing project types to avoid model duplication.
 */
export interface RecommendationInput {
  currentUser: IUser;
  tierAnimes: Anime[];
  candidates: Anime[];
  swipeGenreScores: GenreScoreMap;
  rejectedIds: Set<number>;
}

/**
 * Internal structure used during scoring.
 * Not exposed outside this service.
 */
interface ScoredAnime {
  anime: Anime;
  score: number;
  matchingGenres: string[];
}

@Injectable({ providedIn: 'root' })
export class AnimeRecommendationService {
  /**
   * Tier-list weighting coefficients.
   * Values follow: S > A > B > C.
   */
  private readonly TIER_SCORES = {
    S: 5,
    A: 3,
    B: 1,
    C: -1,
  } as const;

  /**
   * Main recommendation entry point.
   * Pipeline:
   * 1) build the genre preference profile
   * 2) exclude non-recommendable anime (seen / rejected)
   * 3) score remaining candidates
   * 4) pick three complementary recommendations
   */
  generateRecommendations(input: RecommendationInput): RecommendationResult {
    const genreScoreMap = this.buildGenreProfile(input);

    const excludedAnimeIds = this.buildExcludedAnimeIds(input.currentUser, input.rejectedIds);

    const availableAnimes = input.candidates.filter((anime) => {
      const animeId = anime.mal_id;
      if (!animeId) return false;
      return !excludedAnimeIds.has(animeId);
    });

    const scoredAnimes = availableAnimes.map((anime) => this.scoreAnime(anime, genreScoreMap));

    if (scoredAnimes.length === 0) {
      return {
        safestChoice: null,
        popularChoice: null,
        discovery: null,
        genreScores: this.sortGenreScores(genreScoreMap),
      };
    }

    const safestChoice = this.getSafestChoice(scoredAnimes);
    const popularChoice = this.getPopularChoice(scoredAnimes, safestChoice);
    const discovery = this.getDiscoveryChoice(scoredAnimes, safestChoice, popularChoice);

    return {
      safestChoice,
      popularChoice,
      discovery,
      genreScores: this.sortGenreScores(genreScoreMap),
    };
  }

  /**
   * Generates a ranked recommendation list for carousels.
   * Reuses the exact same scoring logic as the 3-card mode.
   */
  generateTopRecommendations(input: RecommendationInput, limit = 12): RankedAnimeRecommendation[] {
    if (!Number.isFinite(limit) || limit <= 0) {
      return [];
    }

    const genreScoreMap = this.buildGenreProfile(input);
    const excludedAnimeIds = this.buildExcludedAnimeIds(input.currentUser, input.rejectedIds);

    const availableAnimes = input.candidates.filter((anime) => {
      const animeId = anime.mal_id;
      if (!animeId) return false;
      return !excludedAnimeIds.has(animeId);
    });

    const scoredAnimes = availableAnimes
      .map((anime) => this.scoreAnime(anime, genreScoreMap))
      .sort((a, b) => b.score - a.score);

    const byId = new Map<number, ScoredAnime>();
    scoredAnimes.forEach((entry) => {
      const animeId = entry.anime.mal_id;
      if (!animeId || byId.has(animeId)) return;
      byId.set(animeId, entry);
    });

    return Array.from(byId.values())
      .slice(0, limit)
      .map((entry) => ({
        anime: entry.anime,
        score: entry.score,
        matchingGenres: entry.matchingGenres,
        explanation: this.buildExplanation(entry.matchingGenres, 'safest_choice'),
      }));
  }

  /**
   * Builds 2-genre and 3-genre combinations, with a single-genre fallback.
   */
  buildGenreCombinations(genreIds: number[]): number[][] {
    if (!genreIds.length) return [];

    const combinations: number[][] = [];
    const unique = [...new Set(genreIds)].filter((id) => id > 0);

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        combinations.push([unique[i], unique[j]]);
      }
    }

    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        for (let k = j + 1; k < unique.length; k++) {
          combinations.push([unique[i], unique[j], unique[k]]);
        }
      }
    }

    if (!combinations.length && unique.length) {
      combinations.push([unique[0]]);
    }

    const byKey = new Map<string, number[]>();
    combinations.forEach((combo) => {
      const normalized = [...combo].sort((a, b) => a - b);
      byKey.set(normalized.join(','), normalized);
    });

    return Array.from(byKey.values()).slice(0, 12);
  }

  /**
   * Returns unique anime IDs present in tier lists (S/A/B/C).
   */
  getTierAnimeIds(tierList: ITierList): number[] {
    return [
      ...new Set([
        ...(tierList.S ?? []),
        ...(tierList.A ?? []),
        ...(tierList.B ?? []),
        ...(tierList.C ?? []),
      ]),
    ];
  }

  /**
   * Deduplicates anime by MAL ID, keeping the first valid occurrence.
   */
  dedupeAnimes(animes: Anime[]): Anime[] {
    const byId = new Map<number, Anime>();

    animes.forEach((anime) => {
      if (!anime?.mal_id) return;
      if (!byId.has(anime.mal_id)) {
        byId.set(anime.mal_id, anime);
      }
    });

    return Array.from(byId.values());
  }

  /**
   * Builds the final genre preference profile by merging:
   * - persisted Swipe scores
   * - implicit preferences from tier-list ranks
   */
  private buildGenreProfile(input: RecommendationInput): Map<number, number> {
    const genreScores = new Map<number, number>();

    // 1) Base profile from persisted Swipe like/dislike scores.
    Object.entries(input.swipeGenreScores).forEach(([genreIdRaw, value]) => {
      const genreId = Number(genreIdRaw);
      if (!Number.isFinite(genreId) || !Number.isFinite(value)) return;
      genreScores.set(genreId, (genreScores.get(genreId) ?? 0) + value);
    });

    // 2) Additional weighting from user's tier-list choices.
    const tierByAnimeId = this.buildTierByAnimeMap(input.currentUser);

    for (const anime of input.tierAnimes) {
      const animeId = anime.mal_id;
      if (!animeId) continue;

      const tier = tierByAnimeId.get(animeId);
      if (!tier) continue;

      const tierWeight = this.TIER_SCORES[tier];
      const genreIds = this.extractGenreIds(anime);

      for (const genreId of genreIds) {
        genreScores.set(genreId, (genreScores.get(genreId) ?? 0) + tierWeight);
      }
    }

    return genreScores;
  }

  /**
   * Builds exclusion set from:
   * - anime already marked as seen
   * - anime explicitly rejected in Swipe
   */
  private buildExcludedAnimeIds(currentUser: IUser, rejectedIds: Set<number>): Set<number> {
    const excluded = new Set<number>();

    currentUser.animeList
      .filter((entry) => entry.status === 'seen')
      .forEach((entry) => excluded.add(entry.animeId));

    rejectedIds.forEach((id) => excluded.add(id));

    return excluded;
  }

  /**
   * Builds an animeId -> tier map (S/A/B/C) from the user's tier list.
   * This enables O(1) lookups while computing the profile.
   */
  private buildTierByAnimeMap(currentUser: IUser): Map<number, keyof typeof this.TIER_SCORES> {
    const tierByAnimeId = new Map<number, keyof typeof this.TIER_SCORES>();

    (Object.keys(this.TIER_SCORES) as Array<keyof typeof this.TIER_SCORES>).forEach((tier) => {
      const ids = currentUser.tierList[tier] ?? [];
      ids.forEach((animeId) => tierByAnimeId.set(animeId, tier));
    });

    return tierByAnimeId;
  }

  /**
   * Scores one candidate anime across four dimensions:
   * - genre affinity
   * - positive genre combination bonus
   * - quality score
   * - normalized popularity
   */
  private scoreAnime(anime: Anime, genreScores: Map<number, number>): ScoredAnime {
    const genreEntries = this.extractGenreEntries(anime);

    let genreScore = 0;
    const matchingGenres: string[] = [];

    for (const genre of genreEntries) {
      const score = genreScores.get(genre.id) ?? 0;
      if (score > 0) {
        genreScore += score;
        matchingGenres.push(genre.name);
      }
    }

    const combinationBonus = this.calculateCombinationBonus(genreEntries, genreScores);
    const qualityScore = this.normalizeScore(anime.score ?? 0);
    const popularityScore = this.normalizePopularity(anime);

    return {
      anime,
      score: genreScore + combinationBonus + qualityScore + popularityScore,
      matchingGenres,
    };
  }

  /**
   * Bonus rewarding anime that match multiple positively scored genres.
   */
  private calculateCombinationBonus(
    animeGenres: Array<{ id: number; name: string }>,
    genreScores: Map<number, number>,
  ): number {
    const positiveGenreScores = animeGenres
      .map((g) => genreScores.get(g.id) ?? 0)
      .filter((score) => score > 0);

    if (positiveGenreScores.length < 2) {
      return 0;
    }

    const combinationSizeBonus = (positiveGenreScores.length - 1) * 3;
    const averageGenreScore =
      positiveGenreScores.reduce((sum, score) => sum + score, 0) / positiveGenreScores.length;

    return combinationSizeBonus + averageGenreScore;
  }

  /**
   * Converts raw rating (typically /10) into scoring contribution.
   */
  private normalizeScore(score: number): number {
    if (!Number.isFinite(score) || score <= 0) return 0;
    return Math.min(10, score);
  }

  /**
   * Normalizes popularity into a bounded score.
   * Prefers `members` (higher means more popular).
   * Falls back to inverted `popularity` rank when needed.
   */
  private normalizePopularity(anime: Anime): number {
    if (anime.members && anime.members > 0) {
      return Math.min(10, Math.log10(anime.members) * 2);
    }

    if (anime.popularity && anime.popularity > 0) {
      const rank = anime.popularity;
      return Math.max(0, 10 - Math.log10(rank) * 3);
    }

    return 0;
  }

  /**
   * Raw popularity score for popular-choice sorting.
   * Higher value means higher popularity.
   */
  private rawPopularity(anime: Anime): number {
    if (anime.members && anime.members > 0) return anime.members;
    if (anime.popularity && anime.popularity > 0) return 1_000_000 / anime.popularity;
    return 0;
  }

  /**
   * Safest choice: top compatibility with slight controlled randomness.
   */
  private getSafestChoice(scoredAnimes: ScoredAnime[]): AnimeRecommendation {
    const sorted = [...scoredAnimes].sort((a, b) => b.score - a.score);
    const topCandidates = sorted.slice(0, 5);
    const selected = this.weightedRandomSelection(topCandidates);

    return {
      anime: selected.anime,
      type: 'safest_choice',
      score: selected.score,
      matchingGenres: selected.matchingGenres,
      explanation: this.buildExplanation(selected.matchingGenres, 'safest_choice'),
    };
  }

  /**
   * Popular choice: still compatible, but ranked by popularity,
   * and distinct from safest choice.
   */
  private getPopularChoice(
    scoredAnimes: ScoredAnime[],
    safestChoice: AnimeRecommendation,
  ): AnimeRecommendation | null {
    const safestId = safestChoice.anime.mal_id;

    const candidates = scoredAnimes
      .filter((entry) => entry.anime.mal_id !== safestId)
      .sort((a, b) => this.rawPopularity(b.anime) - this.rawPopularity(a.anime));

    if (candidates.length === 0) return null;

    const topCandidates = candidates.slice(0, 10);
    const selected = this.weightedRandomSelection(topCandidates);

    return {
      anime: selected.anime,
      type: 'popular_choice',
      score: selected.score,
      matchingGenres: selected.matchingGenres,
      explanation: this.buildExplanation(selected.matchingGenres, 'popular_choice'),
    };
  }

  /**
   * Discovery choice: less popular but relevant,
   * distinct from the two other suggestions.
   */
  private getDiscoveryChoice(
    scoredAnimes: ScoredAnime[],
    safestChoice: AnimeRecommendation,
    popularChoice: AnimeRecommendation | null,
  ): AnimeRecommendation | null {
    const excluded = new Set<number>();
    if (safestChoice.anime.mal_id) excluded.add(safestChoice.anime.mal_id);
    if (popularChoice?.anime.mal_id) excluded.add(popularChoice.anime.mal_id);

    const candidates = scoredAnimes
      .filter((entry) => {
        const animeId = entry.anime.mal_id;
        if (!animeId) return false;
        return !excluded.has(animeId);
      })
      .filter((entry) => entry.matchingGenres.length >= 2)
      .sort((a, b) => this.rawPopularity(a.anime) - this.rawPopularity(b.anime));

    const pool = candidates.length
      ? candidates
      : scoredAnimes.filter((entry) => {
          const animeId = entry.anime.mal_id;
          return !!animeId && !excluded.has(animeId);
        });

    if (pool.length === 0) return null;

    const topCandidates = pool.slice(0, 15);
    const selected = this.weightedRandomSelection(topCandidates);

    return {
      anime: selected.anime,
      type: 'discovery',
      score: selected.score,
      matchingGenres: selected.matchingGenres,
      explanation: this.buildExplanation(selected.matchingGenres, 'discovery'),
    };
  }

  /**
   * Rank-weighted random pick.
   * Higher-ranked entries stay favored while preserving variety.
   */
  private weightedRandomSelection(animes: ScoredAnime[]): ScoredAnime {
    if (!animes.length) {
      throw new Error('Aucun candidat de recommandation disponible.');
    }

    const weights = animes.map((_, index) => animes.length - index);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    let random = Math.random() * totalWeight;

    for (let i = 0; i < animes.length; i++) {
      random -= weights[i];
      if (random <= 0) return animes[i];
    }

    return animes[0];
  }

  /**
   * Sorts genres from highest to lowest affinity score,
   * while keeping UI-friendly labels.
   */
  private sortGenreScores(genreScores: Map<number, number>): RankedGenreScore[] {
    return Array.from(genreScores.entries())
      .map(([genreId, score]) => ({
        genreId,
        genreName: `Genre #${genreId}`,
        score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Builds a human-readable explanation for end users.
   */
  private buildExplanation(matchingGenres: string[], type: RecommendationType): string {
    if (matchingGenres.length === 0) {
      if (type === 'discovery') {
        return 'Sélection découverte: moins attendu, mais intéressant à explorer.';
      }
      if (type === 'popular_choice') {
        return 'Sélection populaire: anime apprécié globalement, proche de tes goûts.';
      }
      return 'Sélection compatible avec ton profil global.';
    }

    if (matchingGenres.length === 1) {
      return `Correspond à ton intérêt pour ${matchingGenres[0]}.`;
    }

    return `Correspond à plusieurs de tes goûts: ${matchingGenres.join(', ')}.`;
  }

  /**
   * Extracts genre IDs from an anime (MAL ID first).
   */
  private extractGenreIds(anime: Anime): number[] {
    return this.extractGenreEntries(anime).map((genre) => genre.id);
  }

  /**
   * Extracts genres as `{ id, name }` entries for scoring and explanations.
   */
  private extractGenreEntries(anime: Anime): Array<{ id: number; name: string }> {
    return (anime.genres ?? [])
      .map((genre) => {
        const id = genre.mal_id ?? (genre as unknown as { id?: number }).id ?? -1;
        const name = genre.name ?? `Genre #${id}`;
        return { id, name };
      })
      .filter((genre) => genre.id > 0);
  }
}
