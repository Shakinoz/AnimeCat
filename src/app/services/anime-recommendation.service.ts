import { Injectable } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { GenreScoreMap } from '../models/anime-list.interface';
import { IUser } from '../models/user.interface';
import { ITierList } from '../models/user-anime.interface';

/**
 * Category type used to distinguish the three kinds of suggestions shown to the user.
 * - safest_choice: the most compatible choice for the current profile
 * - popular_choice: a compatible choice that is more mainstream
 * - discovery: a less obvious but still relevant selection
 */
export type RecommendationType = 'safest_choice' | 'popular_choice' | 'discovery';

/**
 * Represents a genre with a score ready to be displayed or logged.
 * The MAL identifier is kept for calculations, while the name is used in the UI.
 */
export interface RankedGenreScore {
  genreId: number;
  genreName: string;
  score: number;
}

/**
 * Full structure of a final recommendation.
 * The matchingGenres field explains why this anime was selected.
 */
export interface AnimeRecommendation {
  anime: Anime;
  type: RecommendationType;
  score: number;
  matchingGenres: string[];
  explanation: string;
}

/**
 * Complete output of the recommendation engine.
 * The three slots can be null if the candidate pool is too small.
 */
export interface RecommendationResult {
  safestChoice: AnimeRecommendation | null;
  popularChoice: AnimeRecommendation | null;
  discovery: AnimeRecommendation | null;
  genreScores: RankedGenreScore[];
}

/**
 * Represents a ranked recommendation for a list or carousel.
 * Only the information needed for display is kept here.
 */
export interface RankedAnimeRecommendation {
  anime: Anime;
  score: number;
  matchingGenres: string[];
  explanation: string;
}

/**
 * Input data required by the recommendation pipeline.
 * Existing project types are reused here to avoid duplicating models.
 */
export interface RecommendationInput {
  currentUser: IUser;
  tierAnimes: Anime[];
  candidates: Anime[];
  swipeGenreScores: GenreScoreMap;
  rejectedIds: Set<number>;
}

/**
 * Internal structure used during score calculation.
 * It is not exposed outside the service.
 */
interface ScoredAnime {
  anime: Anime;
  score: number;
  matchingGenres: string[];
}

@Injectable({ providedIn: 'root' })
export class AnimeRecommendationService {
  /**
   * Weight values applied according to the user's tier list.
   * The order is intentionally simple: S > A > B > C.
   */
  private readonly TIER_SCORES = {
    S: 5,
    A: 3,
    B: 1,
    C: -1,
  } as const;

  /**
   * Main entry point of the recommendation engine.
   * This method gathers the user's preferences from swipe scores and tier-list placements,
   * removes anime that were already seen or rejected, assigns a score to each candidate,
   * and selects three complementary suggestions.
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
   * Creates an ordered list of recommendations for carousels or lists.
   * It reuses the same scoring logic as the three-card version,
   * but returns more results to feed the UI.
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
   * Builds groups of genres as pairs or trios.
   * This helps identify anime that match several interests at once.
   * Duplicate values are removed and the number of generated combinations is limited.
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
   * Retrieves all anime IDs that appear in the user's tier list.
   * This makes it easier to find anime that the user has already evaluated.
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
   * Removes duplicate anime entries while keeping the first valid occurrence.
   * This avoids processing the same anime multiple times.
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
   * Builds the overall profile of the user's preferred genres.
   * It combines two sources: saved swipe scores and tier-list choices,
   * which add extra weight depending on how highly the anime was ranked.
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
   * Creates the set of anime that should be excluded from recommendations.
   * It removes anime already marked as seen as well as anime explicitly rejected during swipe.
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
   * Builds a mapping from anime ID to tier.
   * This makes it easy to find the anime's tier during profile calculation.
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
   * Evaluates a candidate anime using several criteria:
   * - its closeness to the user's preferred genres
   * - whether it matches several interests at once
   * - its overall rating
   * - its relative popularity
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
   * Adds a bonus if an anime matches several positively scored genres.
   * This favors anime that satisfy multiple interests at once.
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
   * Converts a raw rating into a small score contribution.
   * The value is capped to prevent a very high rating from dominating too strongly.
   */
  private normalizeScore(score: number): number {
    if (!Number.isFinite(score) || score <= 0) return 0;
    return Math.min(10, score);
  }

  /**
   * Normalizes an anime's popularity so it can be compared with other criteria.
   * It prefers the number of members when available; otherwise it uses the popularity ranking.
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
   * Computes a raw popularity value used to rank more popular choices.
   * A higher value means the anime is more popular.
   */
  private rawPopularity(anime: Anime): number {
    if (anime.members && anime.members > 0) return anime.members;
    if (anime.popularity && anime.popularity > 0) return 1_000_000 / anime.popularity;
    return 0;
  }

  /**
   * Selects the safest recommendation.
   * It first looks at the best scores and then adds a small random factor
   * to avoid always producing the exact same result.
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
   * Selects a popular recommendation.
   * It keeps a good level of compatibility but favors more well-known anime.
   * It also avoids picking exactly the same anime as the safest suggestion.
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
   * Selects a discovery recommendation.
   * The goal is to offer an anime that is less obvious than the first two choices,
   * while still being related to the user's tastes.
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
   * Chooses one anime from several candidates while giving a bias toward the best scores.
   * It is not completely random, otherwise the best choices would sometimes be ignored.
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
   * Sorts genres from the highest to the lowest compatibility score.
   * The goal is to display them neatly in the interface.
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
   * Creates a human-readable explanation for the end user.
   * Depending on the genres found, it explains simply why an anime was chosen.
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
   * Extracts the genre IDs from an anime.
   * It first retrieves the genres associated with the anime and then keeps only those with a valid identifier.
   */
  private extractGenreIds(anime: Anime): number[] {
    return this.extractGenreEntries(anime).map((genre) => genre.id);
  }

  /**
   * Extracts the genres of an anime in a simple form: ID and name.
   * This structure is used both for calculations and for displayed explanations.
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
