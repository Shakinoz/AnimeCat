// ─────────────────────────────────────────────────────────────
// user.interface.ts
// Main user model persisted in LocalStorage.
// ─────────────────────────────────────────────────────────────
import { ITierList, IUserAnime } from './user-anime.interface';

/** Represents a registered AnimeCat user. */
export interface IUser {
  /** Username displayed in the UI. */
  username: string;
  /** Email address used for authentication. */
  email: string;
  /** Password (stored in plain text locally, no backend). */
  password: string;
  /** List of anime linked to statuses (watchlist/seen/etc). */
  animeList: IUserAnime[];
  /** User tier-list ranking groups (S/A/B/C). */
  tierList: ITierList;
}

/** Utility subtype containing only authentication fields. */
export type AuthUser = Pick<IUser, 'username' | 'email' | 'password'>;

/** Standard result returned by authentication operations. */
export interface AuthResult {
  success: boolean;
  message: string;
}
