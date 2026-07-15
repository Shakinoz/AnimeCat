import { ITierList, IUserAnime } from "./user-anime.interface";

export interface IUser {
  username: string;
  email: string;
  password: string;

  animeList: IUserAnime[];
  tierList: ITierList;
}
