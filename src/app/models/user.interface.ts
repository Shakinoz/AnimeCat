// ─────────────────────────────────────────────────────────────
// user.interface.ts
// Modèle principal d'un utilisateur stocké dans le LocalStorage.
// ─────────────────────────────────────────────────────────────
import { ITierList, IUserAnime } from './user-anime.interface';

/** Représente un utilisateur enregistré dans AnimeCat. */
export interface IUser {
  /** Pseudo affiché dans l'interface. */
  username: string;
  /** Adresse e-mail utilisée pour l'authentification. */
  email: string;
  /** Mot de passe (stocké en clair — LocalStorage, pas de backend). */
  password: string;
  /** Liste des animés associés à un statut (watchlist, vu…). */
  animeList: IUserAnime[];
  /** Classement Tier List (S, A, B, C) de l'utilisateur. */
  tierList: ITierList;
}

/** Sous-type utilitaire : uniquement les champs d'authentification. */
export type AuthUser = Pick<IUser, 'username' | 'email' | 'password'>;

/** Résultat standard renvoyé par toutes les opérations d'auth. */
export interface AuthResult {
  success: boolean;
  message: string;
}
