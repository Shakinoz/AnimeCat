// ─────────────────────────────────────────────────────────────
// storage.service.ts
// Gestion complète de la persistance LocalStorage :
//   - Authentification (register / login / logout)
//   - Liste des animés de l'utilisateur (statuts)
//   - Notifications réactives via Observable
// ─────────────────────────────────────────────────────────────
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { IUser, AuthResult, AuthUser } from '../models/user.interface';
import { AnimeStatus, ITierList } from '../models/user-anime.interface';
import { GenreScoreMap } from '../models/anime-list.interface';

// ── Clés LocalStorage ─────────────────────────────────────────

/** Clé pour la liste de tous les comptes enregistrés. */
const KEY_USERS = 'anime-cat-users';
/** Clé pour l'utilisateur actuellement connecté. */
const KEY_CURRENT = 'anime-cat-current-user';
/** Clé pour les scores d'affinité de genres (système Swipe). */
const KEY_GENRES = 'anime-cat-genre-scores';
/** Clé pour les animés rejetés dans le Swipe. */
const KEY_REJECTED = 'anime-cat-rejected';

// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StorageService {
  /**
   * Service de persistance local (LocalStorage) pour l'app.
   * - gère l'authentification locale (register/login/logout)
   * - stocke et met à jour les statuts d'animés utilisateur
   * - expose un Observable `animeStatusChanged$` pour la synchronisation
   * - gère les scores de genres et la liste des animés rejetés (Swipe)
   */
  private readonly router = inject(Router);

  /**
   * Subject interne qui émet chaque fois qu'un statut d'animé change.
   * Permet à tous les composants abonnés (AnimeCard, Home…) de
   * se rafraîchir automatiquement sans polling.
   */
  private readonly statusChanged$ = new Subject<void>();

  /** Observable public auquel les composants peuvent s'abonner. */
  readonly animeStatusChanged$: Observable<void> = this.statusChanged$.asObservable();

  constructor() {
    // Patch unique pour émettre aussi sur les changements cross-onglets
    this.patchStorageEvents();
  }

  // ── Authentification ─────────────────────────────────────

  /**
   * Crée un nouveau compte utilisateur.
   * Vérifie l'unicité du pseudo et de l'email avant d'enregistrer.
   */
  register(user: Pick<AuthUser, 'username' | 'email' | 'password'>): AuthResult {
    const users = this.getUsers();

    if (users.some((u) => u.username.toLowerCase() === user.username.toLowerCase())) {
      return { success: false, message: 'Pseudo déjà utilisé' };
    }
    if (users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      return { success: false, message: 'Compte déjà existant pour cet email' };
    }

    const newUser: IUser = {
      username: user.username.trim(),
      email: user.email.trim().toLowerCase(),
      password: user.password,
      animeList: [],
      tierList: { S: [], A: [], B: [], C: [] },
    };

    users.push(newUser);
    localStorage.setItem(KEY_USERS, JSON.stringify(users));
    localStorage.setItem(KEY_CURRENT, JSON.stringify(newUser));

    return { success: true, message: 'Compte créé avec succès' };
  }

  /**
   * Connecte un utilisateur existant avec email + mot de passe.
   */
  login(credentials: Pick<AuthUser, 'email' | 'password'>): AuthResult {
    const email = credentials.email.trim().toLowerCase();
    const user = this.getUsers().find((u) => u.email.toLowerCase() === email);

    if (!user) return { success: false, message: 'Aucun compte trouvé pour cet email' };
    if (user.password !== credentials.password)
      return { success: false, message: 'Mot de passe incorrect' };

    localStorage.setItem(KEY_CURRENT, JSON.stringify(user));
    return { success: true, message: 'Connexion réussie' };
  }

  /** Déconnecte l'utilisateur et redirige vers la page d'accueil. */
  logout(): void {
    localStorage.removeItem(KEY_CURRENT);
    this.router.navigate(['/']);
  }

  /** Retourne true si un utilisateur est actuellement connecté. */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  /** Retourne l'utilisateur connecté, ou null si non connecté. */
  getCurrentUser(): IUser | null {
    const raw = localStorage.getItem(KEY_CURRENT);
    return raw ? (JSON.parse(raw) as IUser) : null;
  }

  // ── Gestion des statuts d'animés ──────────────────────────

  /**
   * Ajoute ou met à jour le statut d'un animé pour l'utilisateur connecté.
   * Si l'animé est déjà dans la liste, son statut est mis à jour.
   * Sinon, une nouvelle entrée est créée.
   */
  updateAnimeStatus(animeId: number, status: AnimeStatus): void {
    const user = this.getCurrentUser();
    if (!user) return;

    const existing = user.animeList.find((a) => a.animeId === animeId);
    if (existing) {
      existing.status = status;
    } else {
      user.animeList.push({ animeId, status });
    }

    this.persistCurrentUser(user);
  }

  /**
   * Supprime un animé de la liste de l'utilisateur (toutes statuts).
   */
  removeAnime(animeId: number): void {
    const user = this.getCurrentUser();
    if (!user) return;

    user.animeList = user.animeList.filter((a) => a.animeId !== animeId);
    this.persistCurrentUser(user);
  }

  /**
   * Retourne le statut courant d'un animé, ou null si non enregistré.
   */
  getAnimeStatus(mal_id: number): AnimeStatus | null {
    return this.getCurrentUser()?.animeList.find((a) => a.animeId === mal_id)?.status ?? null;
  }

  /**
   * Déplace un animé vers un rang de tier list (S/A/B/C), ou le retire de la tier list.
   * Retourne l'ancien et le nouveau rang pour permettre des effets de scoring côté UI.
   */
  updateAnimeTier(
    animeId: number,
    tier: keyof ITierList | null,
  ): { previousTier: keyof ITierList | null; nextTier: keyof ITierList | null } | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    user.tierList ??= { S: [], A: [], B: [], C: [] };

    const tiers: Array<keyof ITierList> = ['S', 'A', 'B', 'C'];
    const previousTier =
      tiers.find((tierKey) => (user.tierList[tierKey] ?? []).includes(animeId)) ?? null;

    if (previousTier === tier) {
      return { previousTier, nextTier: tier };
    }

    tiers.forEach((tierKey) => {
      user.tierList[tierKey] = (user.tierList[tierKey] ?? []).filter((id) => id !== animeId);
    });

    if (tier) {
      user.tierList[tier] = [...(user.tierList[tier] ?? []), animeId];
    }

    this.persistCurrentUser(user);

    return { previousTier, nextTier: tier };
  }

  // ── Scores de genres (Swipe) ──────────────────────────────

  /**
   * Retourne la map de scores d'affinité des genres.
   * Clé = identifiant MAL du genre, valeur = score (peut être négatif).
   */
  getGenreScores(): GenreScoreMap {
    const raw = localStorage.getItem(KEY_GENRES);
    return raw ? (JSON.parse(raw) as GenreScoreMap) : {};
  }

  /**
   * Applique des deltas de score sur les genres existants.
   * @param deltas Objet { genreId: delta } à ajouter aux scores actuels
   */
  applyGenreDeltas(deltas: GenreScoreMap): void {
    const scores = this.getGenreScores();
    Object.entries(deltas).forEach(([k, v]) => {
      scores[Number(k)] = (scores[Number(k)] ?? 0) + v;
    });
    localStorage.setItem(KEY_GENRES, JSON.stringify(scores));
  }

  // ── Animés rejetés (Swipe) ────────────────────────────────

  /** Ajoute un animé à la liste des animés refusés dans le Swipe. */
  addRejected(animeId: number): void {
    const list = this.getRejected();
    if (!list.includes(animeId)) {
      list.push(animeId);
      localStorage.setItem(KEY_REJECTED, JSON.stringify(list));
    }
  }

  /** Retire un animé de la liste des rejetés (utilisé par Undo). */
  removeRejected(animeId: number): void {
    const filtered = this.getRejected().filter((id) => id !== animeId);
    localStorage.setItem(KEY_REJECTED, JSON.stringify(filtered));
  }

  /** Retourne la liste de tous les identifiants d'animés rejetés. */
  getRejected(): number[] {
    const raw = localStorage.getItem(KEY_REJECTED);
    return raw ? (JSON.parse(raw) as number[]) : [];
  }

  // ── Méthodes privées ──────────────────────────────────────

  /** Retourne tous les utilisateurs enregistrés. */
  private getUsers(): IUser[] {
    const raw = localStorage.getItem(KEY_USERS);
    return raw ? (JSON.parse(raw) as IUser[]) : [];
  }

  /**
   * Sauvegarde l'utilisateur courant en LocalStorage et met à jour
   * la liste globale des utilisateurs. Émet ensuite une notification.
   */
  private persistCurrentUser(user: IUser): void {
    localStorage.setItem(KEY_CURRENT, JSON.stringify(user));

    const users = this.getUsers();
    const index = users.findIndex((u) => u.email === user.email);
    if (index !== -1) {
      users[index] = user;
      localStorage.setItem(KEY_USERS, JSON.stringify(users));
    }

    this.statusChanged$.next();
  }

  /**
   * Patch unique sur Storage.prototype pour émettre des événements
   * personnalisés lorsque les clés AnimeCat changent.
   * Permet la synchronisation entre onglets (window storage event).
   * Le flag __animeCatStoragePatched évite les doubles patches.
   */
  private patchStorageEvents(): void {
    const win = window as Window & { __animeCatStoragePatched?: boolean };
    if (win.__animeCatStoragePatched) return;

    const relevantKeys = new Set([KEY_USERS, KEY_CURRENT]);
    const originalSetItem = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    const EVENT = 'anime-cat-storage-changed';

    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (relevantKeys.has(key)) window.dispatchEvent(new CustomEvent(EVENT));
    };

    Storage.prototype.removeItem = function (key) {
      originalRemove.call(this, key);
      if (relevantKeys.has(key)) window.dispatchEvent(new CustomEvent(EVENT));
    };

    window.addEventListener(EVENT, () => this.statusChanged$.next());
    window.addEventListener('storage', () => this.statusChanged$.next());

    win.__animeCatStoragePatched = true;
  }
}
