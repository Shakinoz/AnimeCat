// ─────────────────────────────────────────────────────────────
// tenrai.service.ts
// API access layer for Tenrai (Jikan v4 mirror).
// All HTTP requests are routed through this service.
// ─────────────────────────────────────────────────────────────
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, map, mergeMap, tap, toArray } from 'rxjs/operators';
import type { Anime } from '@tutkli/jikan-ts';
import { AnimeListResult } from '../models/anime-list.interface';
import { SearchParams } from '../models/search-param.interface';

// ── Raw API envelope ───────────────────────

/** Shape of the raw JSON response returned by Tenrai/Jikan. */
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
 * HTTP service for the Tenrai API (Jikan mirror).
 * Centralizes remote calls and exposes display helpers
 * (cover URL, title, genre labels) used by UI components.
 */
export class TenraiService {
  /** API base URL. Change this value to use another mirror. */
  private readonly baseUrl = 'https://api.tenrai.org/v1';
  /** In-memory cache for already fetched anime details. */
  private readonly animeCache = new Map<string, Anime>();

  constructor(private readonly http: HttpClient) {}

  // ── List endpoints ─────────────────────────────────────

  /**
   * Fetches currently airing anime (trending list).
   * Used by Home (hero + carousel) and Swipe.
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
   * Fetches most popular anime by member count.
   * Used in Home's popular carousel.
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
   * Fetches top-rated anime.
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
   * Fetches anime from the current season.
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
   * Fetches anime for a specific season.
   * @param year Year value (for example: 2024).
   * @param season One of: spring, summer, fall, winter.
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

  // ── Search ─────────────────────────────────────────────

  /**
   * Quick search by title, used by Searchbar autocomplete.
   * @param query User input query.
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
   * Advanced search with multiple filters, used by Catalogue.
   * Undefined filter values are ignored when building query params.
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

  // ── Detail endpoints ────────────────────────────────────────────────

  /**
   * Fetches full anime details by MAL id.
   * Tries `/full` first, then falls back to summary endpoint on error.
   */
  getById(id: number, full = true): Observable<Anime> {
    const cacheKey = `${full ? 'full' : 'summary'}:${id}`;
    const cached = this.animeCache.get(cacheKey);

    if (cached) {
      return of(cached);
    }

    const request$ = this.http
      .get<TenraiEnvelope<Anime>>(`${this.baseUrl}/anime/${id}${full ? '/full' : ''}`)
      .pipe(
        map((res) => this.extractData(res) as Anime),
        tap((anime) => this.animeCache.set(cacheKey, anime)),
      );

    if (full) {
      return request$.pipe(catchError(() => this.getById(id, false)));
    }

    return request$;
  }

  /**
   * Fetches multiple anime while limiting concurrent requests.
   * Individual request errors are ignored to keep partial results.
   */
  getByIds(ids: number[], full = false, concurrency = 2): Observable<Anime[]> {
    const uniqueIds = [...new Set(ids)];

    if (!uniqueIds.length) {
      return of([]);
    }

    return from(uniqueIds).pipe(
      mergeMap(
        (animeId) =>
          this.getById(animeId, full).pipe(
            map((anime) => ({ anime, animeId })),
            catchError(() => of(null)),
          ),
        concurrency,
      ),
      toArray(),
      map((entries) =>
        entries
          .filter((entry): entry is { anime: Anime; animeId: number } => entry !== null)
          .map((entry) => entry.anime),
      ),
    );
  }

  /**
   * Fetches anime character data.
   * Returns `any` because upstream payload shape can vary.
   */
  getCharacters(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/characters`)
      .pipe(map((res) => this.extractData(res)));
  }

  /**
   * Fetches recommendations related to a specific anime.
   */
  getRecommendations(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/recommendations`)
      .pipe(map((res) => this.extractData(res)));
  }

  // ── Special filters ──────────────────────────────────────

  /**
   * Fetches anime filtered by MAL genre IDs.
   * Used by the Swipe recommendation pipeline.
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
   * Fetches a random anime.
   */
  getRandom(): Observable<Anime> {
    return this.http.get<TenraiEnvelope<Anime>>(`${this.baseUrl}/random/anime`).pipe(
      map((res) => this.extractData(res) as Anime),
      catchError(() => of({} as Anime)),
    );
  }

  // ── Display utilities ───────────────────────────────

  /**
   * Returns the best available cover URL.
   * Preference order: large WebP → large JPG → local placeholder.
   */
  getCoverUrl(anime: Anime): string {
    return (
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.large_image_url ??
      'assets/img/placeholder.webp'
    );
  }

  /**
   * Returns the display title, preferring English when available.
   */
  getDisplayTitle(anime: Anime): string {
    return anime.title_english?.trim() || anime.title;
  }

  /**
   * Returns a human-readable genres label.
   * @param max Maximum number of genres to include.
   */
  getGenresLabel(anime: Anime, max = 4): string {
    return (anime.genres ?? [])
      .slice(0, max)
      .map((g) => g.name)
      .join(', ');
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Builds `HttpParams` while skipping null/undefined/empty values.
   * This keeps request URLs compact and predictable.
   */
  private buildParams(values: Record<string, unknown>): HttpParams {
    return Object.entries(values).reduce((params, [key, value]) => {
      if (value === undefined || value === null || value === '') return params;
      return params.set(key, String(value));
    }, new HttpParams());
  }

  /**
   * Extracts `data` when the payload matches Tenrai envelope shape,
   * otherwise returns the payload as-is (compatibility fallback).
   */
  private extractData<T>(res: TenraiEnvelope<T> | T): T {
    if (res && typeof res === 'object' && 'data' in res) {
      return (res as TenraiEnvelope<T>).data as T;
    }
    return res as T;
  }

  /**
   * Converts a raw paginated payload into normalized `AnimeListResult`.
   * Centralizes optional pagination handling in one place.
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
