import { Injectable } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { GenreScoreMap } from '../models/anime-list.interface';
import { IUser } from '../models/user.interface';

/**
 * Type de recommandation affiché dans l'UI.
 * - safest_choice : proposition la plus compatible avec les goûts actuels
 * - popular_choice: proposition compatible et plus grand public
 * - discovery     : proposition moins connue mais cohérente
 */
export type RecommendationType = 'safest_choice' | 'popular_choice' | 'discovery';

/**
 * Score de genre prêt à afficher / logger.
 * On conserve l'ID MAL pour les traitements, et un nom pour l'affichage.
 */
export interface RankedGenreScore {
  genreId: number;
  genreName: string;
  score: number;
}

/**
 * Représente une recommandation finalisée.
 * `matchingGenres` sert à expliquer clairement pourquoi l'anime a été choisi.
 */
export interface AnimeRecommendation {
  anime: Anime;
  type: RecommendationType;
  score: number;
  matchingGenres: string[];
  explanation: string;
}

/**
 * Sortie complète du moteur.
 * Les 3 suggestions sont optionnelles si le pool candidat est trop petit.
 */
export interface RecommendationResult {
  safestChoice: AnimeRecommendation | null;
  popularChoice: AnimeRecommendation | null;
  discovery: AnimeRecommendation | null;
  genreScores: RankedGenreScore[];
}

/**
 * Entrées nécessaires pour générer les recommandations.
 * On réutilise les types du projet pour éviter toute duplication de modèle.
 */
export interface RecommendationInput {
  currentUser: IUser;
  tierAnimes: Anime[];
  candidates: Anime[];
  swipeGenreScores: GenreScoreMap;
  rejectedIds: Set<number>;
}

/**
 * Structure interne utilisée pendant le scoring.
 * Non exposée en dehors du service.
 */
interface ScoredAnime {
  anime: Anime;
  score: number;
  matchingGenres: string[];
}

@Injectable({ providedIn: 'root' })
export class AnimeRecommendationService {
  /**
   * Pondération de la tier list.
   * Ces valeurs suivent le principe discuté: S > A > B > C.
   */
  private readonly TIER_SCORES = {
    S: 5,
    A: 3,
    B: 1,
    C: -1,
  } as const;

  /**
   * Point d'entrée principal du moteur de recommandation.
   * Pipeline:
   * 1) construire le profil de goûts (genres)
   * 2) exclure les animés non recommandables (vus / planifiés / rejetés)
   * 3) scorer les candidats
   * 4) sélectionner 3 recommandations complémentaires
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
   * Construit le profil de goûts final en fusionnant:
   * - les scores issus du swipe (stockés en local)
   * - les préférences implicites de la tier list
   */
  private buildGenreProfile(input: RecommendationInput): Map<number, number> {
    const genreScores = new Map<number, number>();

    // 1) Base: score agrégé provenant des likes/dislikes swipe déjà persistés.
    Object.entries(input.swipeGenreScores).forEach(([genreIdRaw, value]) => {
      const genreId = Number(genreIdRaw);
      if (!Number.isFinite(genreId) || !Number.isFinite(value)) return;
      genreScores.set(genreId, (genreScores.get(genreId) ?? 0) + value);
    });

    // 2) Complément: influence de la tier list utilisateur sur les genres.
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
   * Exclut des recommandations:
   * - les animés déjà vus / planifiés dans la liste utilisateur
   * - les animés explicitement rejetés dans le swipe
   */
  private buildExcludedAnimeIds(currentUser: IUser, rejectedIds: Set<number>): Set<number> {
    const excluded = new Set<number>();

    currentUser.animeList
      .filter((entry) => entry.status === 'seen' || entry.status === 'plan_to_watch')
      .forEach((entry) => excluded.add(entry.animeId));

    rejectedIds.forEach((id) => excluded.add(id));

    return excluded;
  }

  /**
   * Produit la table animeId -> tier (S/A/B/C) à partir de la tier list.
   * Cela permet un lookup O(1) pendant le calcul du profil.
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
   * Score un anime candidat selon 4 dimensions:
   * - affinité de genres
   * - bonus de combinaison de genres appréciés
   * - qualité (note)
   * - popularité normalisée
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
   * Bonus qui favorise les animés combinant plusieurs genres positifs.
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
   * Transforme la note (souvent déjà /10) en composante de score.
   */
  private normalizeScore(score: number): number {
    if (!Number.isFinite(score) || score <= 0) return 0;
    return Math.min(10, score);
  }

  /**
   * Normalise la popularité en score borné.
   * Priorité à `members` (plus grand = plus populaire).
   * Fallback `popularity` (rang, plus petit = plus populaire) inversé.
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
   * Score brut de popularité pour les tris "popular choice".
   * Valeur plus élevée = anime plus populaire.
   */
  private rawPopularity(anime: Anime): number {
    if (anime.members && anime.members > 0) return anime.members;
    if (anime.popularity && anime.popularity > 0) return 1_000_000 / anime.popularity;
    return 0;
  }

  /**
   * Choix le plus sûr: top score de compatibilité,
   * avec une légère variété (random pondéré sur top 5).
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
   * Choix populaire: anime encore compatible, trié par popularité,
   * distinct du "choix sûr".
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
   * Choix découverte: anime moins populaire mais pertinent,
   * différent des 2 autres suggestions.
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
   * Random pondéré par rang: les meilleurs restent favorisés,
   * tout en gardant un peu de variété d'une session à l'autre.
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
   * Trie les genres du plus apprécié au moins apprécié,
   * en gardant un nom exploitable pour l'UI.
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
   * Génère une explication lisible pour l'utilisateur final.
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
   * Extrait les IDs de genres d'un anime (MAL ID prioritaire).
   */
  private extractGenreIds(anime: Anime): number[] {
    return this.extractGenreEntries(anime).map((genre) => genre.id);
  }

  /**
   * Extrait les genres sous forme {id, name} pour calcul et explications.
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
