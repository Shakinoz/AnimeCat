import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// @tutkli/jikan-ts — types et client
import {
  AnimeClient,
  JikanResponse,
  Anime,
  AnimeSearchParams,
  RandomClient,
  TopClient,
  SeasonsClient,
} from '@tutkli/jikan-ts';
import { AnimeListResult } from '../models/anime-list.interface';
import { SearchParams } from '../models/search-param.interface';

@Injectable({ providedIn: 'root' })
export class JikanService {
  // @tutkli/jikan-ts gère le cache (axios-cache-interceptor)
  // et le rate-limiting en interne — pas besoin de le refaire.
  private readonly client = new AnimeClient();
  private readonly randomClient = new RandomClient();
  private readonly topClient = new TopClient();
  private readonly seasonClient = new SeasonsClient();

  // ─────────────────────────────────────────────────────────
  // LANDING PAGE
  // ─────────────────────────────────────────────────────────

  /**
   * Animés actuellement en diffusion
   * → Hero Slider + carousel "Tendances"
   */
  getTopAiring(page = 1, limit = 16): Observable<AnimeListResult> {
    return from(this.topClient.getTopAnime({ filter: 'airing', page, limit })).pipe(
      map((res) => this.toResult(res)),
    );
  }

  /**
   * Animés les plus populaires (par membres MAL)
   * → Carousel "Les plus populaires"
   */
  getMostPopular(page = 1, limit = 16): Observable<AnimeListResult> {
    return from(this.topClient.getTopAnime({ filter: 'bypopularity', page, limit })).pipe(
      map((res) => this.toResult(res)),
    );
  }

  /**
   * Meilleurs scores de tous les temps
   * → Section "Mieux notés"
   */
  getTopScore(page = 1, limit = 16): Observable<AnimeListResult> {
    return from(this.topClient.getTopAnime({ page, limit })).pipe(map((res) => this.toResult(res)));
  }

  /**
   * Animés de la saison en cours
   * → Section "Cette saison"
   */
  getCurrentSeason(page = 1, limit = 16): Observable<AnimeListResult> {
    return from(this.seasonClient.getSeasonNow({ page, limit })).pipe(
      map((res) => this.toResult(res)),
    );
  }

  /**
   * Animés d'une saison spécifique
   * ex: getSeason(2024, 'fall')
   */
  getSeason(
    year: number,
    season: 'spring' | 'summer' | 'fall' | 'winter',
    page = 1,
    limit = 16,
  ): Observable<AnimeListResult> {
    return from(this.seasonClient.getSeason(year, season, { page, limit })).pipe(
      map((res) => this.toResult(res)),
    );
  }

  // ─────────────────────────────────────────────────────────
  // RECHERCHE
  // ─────────────────────────────────────────────────────────

  /**
   * Recherche par nom — SearchBar (suggestions) + page /search
   */
  searchByName(query: string, page = 1, limit = 8): Observable<AnimeListResult> {
    return from(this.client.getAnimeSearch({ q: query, page, limit, sfw: true })).pipe(
      map((res) => this.toResult(res)),
    );
  }

  /**
   * Recherche avancée avec filtres — page Catalogue
   */
  searchAdvanced(params: SearchParams): Observable<AnimeListResult> {
    const p: AnimeSearchParams = {
      q: params.query || undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      sfw: true,
      genres: params.genres?.join(','),
      min_score: params.minScore,
      type: params.type as any,
      status: params.status as any,
      order_by: 'score',
      sort: 'desc',
    };
    return from(this.client.getAnimeSearch(p)).pipe(map((res) => this.toResult(res)));
  }

  // ─────────────────────────────────────────────────────────
  // DÉTAIL
  // ─────────────────────────────────────────────────────────

  /**
   * Fiche complète par MAL ID — page /detail/:id
   */
  getById(id: number): Observable<Anime> {
    return from(this.client.getAnimeFullById(id)).pipe(map((res) => res.data));
  }

  /**
   * Personnages d'un animé
   */
  getCharacters(id: number) {
    return from(this.client.getAnimeCharacters(id)).pipe(map((res) => res.data));
  }

  /**
   * Recommandations liées à un animé
   */
  getRecommendations(id: number) {
    return from(this.client.getAnimeRecommendations(id)).pipe(map((res) => res.data));
  }

  // ─────────────────────────────────────────────────────────
  // SWIPE & RECOMMANDATIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Animés filtrés par genre IDs
   * Utilisé par RecommendationService pour alimenter le Swipe
   */
  getByGenres(genreIds: number[], page = 1, limit = 25): Observable<AnimeListResult> {
    return from(
      this.client.getAnimeSearch({
        genres: genreIds.join(','),
        order_by: 'score',
        sort: 'desc',
        page,
        limit,
        sfw: true,
      }),
    ).pipe(map((res) => this.toResult(res)));
  }

  /**
   * Animé aléatoire — pour varier le Swipe quand pas assez de données
   */
  getRandom(): Observable<Anime> {
    return from(this.randomClient.getRandomAnime()).pipe(map((res) => res.data));
  }

  // ─────────────────────────────────────────────────────────
  // UTILITAIRES (utilisés dans les templates)
  // ─────────────────────────────────────────────────────────

  /** Cover haute résolution (webp > jpg > placeholder) */
  getCoverUrl(anime: Anime): string {
    return (
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.large_image_url ??
      'assets/img/placeholder.webp'
    );
  }

  /** Titre affiché : anglais si dispo, sinon titre original */
  getDisplayTitle(anime: Anime): string {
    return anime.title_english?.trim() || anime.title;
  }

  /** Genres sous forme de string lisible (max 4) */
  getGenresLabel(anime: Anime, max = 4): string {
    return (anime.genres ?? [])
      .slice(0, max)
      .map((g) => g.name)
      .join(', ');
  }

  /** Normalise le JikanResponse en AnimeListResult */
  private toResult(res: JikanResponse<Anime[]>): AnimeListResult {
    return {
      data: res.data,
      hasNextPage: res.pagination?.has_next_page ?? false,
      currentPage: res.pagination?.current_page ?? 1,
      total: res.pagination?.items!.total ?? 0,
    };
  }
}
