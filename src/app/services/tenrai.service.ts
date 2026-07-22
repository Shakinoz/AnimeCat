// ─────────────────────────────────────────────────────────────
// tenrai.service.ts
// Couche d'accès à l'API Tenrai (miroir Jikan v4).
// Toutes les requêtes HTTP passent par ce service.
// ─────────────────────────────────────────────────────────────
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { Anime } from '@tutkli/jikan-ts';
import { AnimeListResult } from '../models/anime-list.interface';
import { SearchParams } from '../models/search-param.interface';

// ── Enveloppe brute renvoyée par l'API ───────────────────────

/** Structure de la réponse JSON brute de Tenrai/Jikan. */
interface TenraiEnvelope<T> {
  data?: T;
  pagination?: {
    has_next_page?: boolean;
    current_page?: number;
    items?: { total?: number };
    total?: number;
  };
}

// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
/**
 * Service HTTP vers l'API Tenrai (Jikan mirror).
 * Centralise toutes les requêtes réseau et fournit des helpers
 * d'affichage (cover, titres, labels de genres) utilisés par les composants.
 */
export class TenraiService {
  /** URL de base de l'API. Changer ici pour pointer vers un autre miroir. */
  private readonly baseUrl = 'https://api.tenrai.org/v1';

  constructor(private readonly http: HttpClient) {}

  // ── Méthodes de liste ─────────────────────────────────────

  /**
   * Récupère les animés actuellement en diffusion (trending).
   * Utilisé par la page Home (hero + carousel) et la page Swipe.
   */
  getTopAiring(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.buildParams({ filter: 'airing', page, limit }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Récupère les animés les plus populaires (par nombre de membres).
   * Utilisé dans le carousel "Populaires" de la Home.
   */
  getMostPopular(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.buildParams({ filter: 'bypopularity', page, limit }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Récupère les animés les mieux notés (tri par score).
   */
  getTopScore(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.buildParams({ page, limit }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Récupère les animés de la saison en cours.
   */
  getCurrentSeason(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/seasons/now`, {
        params: this.buildParams({ page, limit }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Récupère les animés d'une saison spécifique.
   * @param year  Année (ex : 2024)
   * @param season Saison parmi spring | summer | fall | winter
   */
  getSeason(
    year: number,
    season: 'spring' | 'summer' | 'fall' | 'winter',
    page = 1,
    limit = 16,
  ): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/seasons/${year}/${season}`, {
        params: this.buildParams({ page, limit }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  // ── Recherche ─────────────────────────────────────────────

  /**
   * Recherche rapide par nom — utilisée par la Searchbar (autocomplete).
   * @param query Texte saisi par l'utilisateur
   */
  searchByName(query: string, page = 1, limit = 8): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.buildParams({ q: query, page, limit, sfw: true }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Recherche avancée avec filtres multiples — utilisée par la page Catalogue.
   * Les paramètres non définis sont simplement ignorés.
   */
  searchAdvanced(params: SearchParams): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.buildParams({
          q: params.query || undefined,
          page: params.page ?? 1,
          limit: params.limit ?? 20,
          sfw: true,
          genres: params.genres?.join(','),
          min_score: params.minScore,
          type: params.type,
          status: params.status,
          order_by: 'score',
          sort: 'desc',
        }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  // ── Détail ────────────────────────────────────────────────

  /**
   * Récupère la fiche complète d'un animé par son identifiant MAL.
   * Essaie d'abord l'endpoint /full (plus de données),
   * avec fallback sur l'endpoint standard en cas d'erreur.
   */
  getById(id: number): Observable<Anime> {
    return this.http.get<TenraiEnvelope<Anime>>(`${this.baseUrl}/anime/${id}/full`).pipe(
      map((res) => this.extractData(res) as Anime),
      catchError(() =>
        this.http
          .get<TenraiEnvelope<Anime>>(`${this.baseUrl}/anime/${id}`)
          .pipe(map((inner) => this.extractData(inner) as Anime)),
      ),
    );
  }

  /**
   * Récupère les personnages principaux d'un animé.
   * Retourne any car la structure varie selon les animés.
   */
  getCharacters(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/characters`)
      .pipe(map((res) => this.extractData(res)));
  }

  /**
   * Récupère les recommandations d'animés similaires.
   */
  getRecommendations(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/recommendations`)
      .pipe(map((res) => this.extractData(res)));
  }

  // ── Filtres spéciaux ──────────────────────────────────────

  /**
   * Récupère des animés filtrés par liste de genres MAL.
   * Utilisé par le moteur de recommandation du Swipe.
   */
  getByGenres(genreIds: number[], page = 1, limit = 25): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.buildParams({
          genres: genreIds.join(','),
          order_by: 'score',
          sort: 'desc',
          page,
          limit,
          sfw: true,
        }),
      })
      .pipe(
        map((res) => this.normalizeList(res)),
        catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 })),
      );
  }

  /**
   * Récupère un animé aléatoire.
   */
  getRandom(): Observable<Anime> {
    return this.http.get<TenraiEnvelope<Anime>>(`${this.baseUrl}/random/anime`).pipe(
      map((res) => this.extractData(res) as Anime),
      catchError(() => of({} as Anime)),
    );
  }

  // ── Utilitaires d'affichage ───────────────────────────────

  /**
   * Retourne l'URL de la meilleure image disponible.
   * Ordre de préférence : WebP large → JPG large → placeholder local.
   */
  getCoverUrl(anime: Anime): string {
    return (
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.large_image_url ??
      'assets/img/placeholder.webp'
    );
  }

  /**
   * Retourne le titre à afficher : anglais en priorité, puis japonais.
   */
  getDisplayTitle(anime: Anime): string {
    return anime.title_english?.trim() || anime.title;
  }

  /**
   * Retourne les genres formatés en chaîne lisible.
   * @param max Nombre maximum de genres à afficher (défaut : 4)
   */
  getGenresLabel(anime: Anime, max = 4): string {
    return (anime.genres ?? [])
      .slice(0, max)
      .map((g) => g.name)
      .join(', ');
  }

  // ── Méthodes privées ──────────────────────────────────────

  /**
   * Construit un objet HttpParams en ignorant les valeurs null/undefined/vides.
   * Toutes les requêtes utilisent cette méthode pour garder les URLs propres.
   */
  private buildParams(values: Record<string, unknown>): HttpParams {
    return Object.entries(values).reduce((params, [key, value]) => {
      if (value === undefined || value === null || value === '') return params;
      return params.set(key, String(value));
    }, new HttpParams());
  }

  /**
   * Extrait le champ `data` si l'objet a la structure d'une enveloppe Tenrai,
   * sinon retourne l'objet tel quel (compatibilité avec les deux formats d'API).
   */
  private extractData<T>(res: TenraiEnvelope<T> | T): T {
    if (res && typeof res === 'object' && 'data' in res) {
      return (res as TenraiEnvelope<T>).data as T;
    }
    return res as T;
  }

  /**
   * Convertit une réponse paginée brute en AnimeListResult normalisé.
   * Centralise la gestion des propriétés optionnelles de la pagination.
   */
  private normalizeList(res: TenraiEnvelope<Anime[]>): AnimeListResult {
    const data = this.extractData<Anime[]>(res as TenraiEnvelope<Anime[]>);
    const pagination = res.pagination;

    return {
      data: Array.isArray(data) ? data : [],
      hasNextPage: pagination?.has_next_page ?? false,
      currentPage: pagination?.current_page ?? 1,
      total: pagination?.items?.total ?? pagination?.total ?? 0,
    };
  }
}
