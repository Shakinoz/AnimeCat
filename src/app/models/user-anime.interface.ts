import { Anime } from "@tutkli/jikan-ts";

export type AnimeStatus = 'watching' | 'seen' | 'plan_to_watch';

export interface IUserAnime {
  animeId: number;
  status: AnimeStatus;
  score?: number;
  favorite?: boolean;
}

export interface ITierList {
  S: number[];
  A: number[];
  B: number[];
  C: number[];
}

export interface HomeAnime extends Anime {
  userStatus?: AnimeStatus | null;
}
