import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { Anime } from '@tutkli/jikan-ts';
import { AnimeListResult } from '../models/anime-list.interface';
import { SearchParams } from '../models/search-param.interface';

interface TenraiEnvelope<T> {
  data?: T;
  pagination?: {
    has_next_page?: boolean;
    current_page?: number;
    items?: { total?: number };
    total?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class TenraiService {
  private readonly baseUrl = 'https://api.tenrai.org/v1';

  constructor(private readonly http: HttpClient) {}

  getTopAiring(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.toParams({ filter: 'airing', page, limit }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  getMostPopular(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.toParams({ filter: 'bypopularity', page, limit }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  getTopScore(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/top/anime`, {
        params: this.toParams({ page, limit }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  getCurrentSeason(page = 1, limit = 16): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/seasons/now`, {
        params: this.toParams({ page, limit }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  getSeason(
    year: number,
    season: 'spring' | 'summer' | 'fall' | 'winter',
    page = 1,
    limit = 16,
  ): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/seasons/${year}/${season}`, {
        params: this.toParams({ page, limit }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  searchByName(query: string, page = 1, limit = 8): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.toParams({ q: query, page, limit, sfw: true }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  searchAdvanced(params: SearchParams): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.toParams({
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
      .pipe(map((res) => this.toResult(res)));
  }

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

  getCharacters(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/characters`)
      .pipe(map((res) => this.extractData(res)));
  }

  getRecommendations(id: number): Observable<any> {
    return this.http
      .get(`${this.baseUrl}/anime/${id}/recommendations`)
      .pipe(map((res) => this.extractData(res)));
  }

  getByGenres(genreIds: number[], page = 1, limit = 25): Observable<AnimeListResult> {
    return this.http
      .get<TenraiEnvelope<Anime[]>>(`${this.baseUrl}/anime`, {
        params: this.toParams({
          genres: genreIds.join(','),
          order_by: 'score',
          sort: 'desc',
          page,
          limit,
          sfw: true,
        }),
      })
      .pipe(map((res) => this.toResult(res)));
  }

  getRandom(): Observable<Anime> {
    return this.http
      .get<TenraiEnvelope<Anime>>(`${this.baseUrl}/random/anime`)
      .pipe(map((res) => this.extractData(res) as Anime));
  }

  getCoverUrl(anime: Anime): string {
    return (
      anime.images?.webp?.large_image_url ??
      anime.images?.jpg?.large_image_url ??
      'assets/img/placeholder.webp'
    );
  }

  getDisplayTitle(anime: Anime): string {
    return anime.title_english?.trim() || anime.title;
  }

  getGenresLabel(anime: Anime, max = 4): string {
    return (anime.genres ?? [])
      .slice(0, max)
      .map((g) => g.name)
      .join(', ');
  }

  private toParams(values: Record<string, unknown>): HttpParams {
    let params = new HttpParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      params = params.set(key, String(value));
    });
    return params;
  }

  private extractData<T>(res: TenraiEnvelope<T> | T): T {
    if (res && typeof res === 'object' && 'data' in res) {
      return (res as TenraiEnvelope<T>).data as T;
    }
    return res as T;
  }

  private toResult(res: TenraiEnvelope<Anime[]>): AnimeListResult {
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
