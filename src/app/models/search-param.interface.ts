export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  genres?: number[];
  minScore?: number;
  type?: 'tv' | 'movie' | 'ova' | 'special' | 'ona' | 'music';
  status?: 'airing' | 'complete' | 'upcoming';
}
