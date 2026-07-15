import { Anime } from '@tutkli/jikan-ts';

export interface AnimeListResult {
  data: Anime[];
  hasNextPage: boolean;
  currentPage: number;
  total: number;
}

