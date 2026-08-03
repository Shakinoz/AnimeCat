// ─────────────────────────────────────────────────────────────
// storage.service.ts
// Complete LocalStorage persistence layer:
//   - Authentication (register / login / logout)
//   - User anime list status management
//   - Reactive update notifications via Observable
// ─────────────────────────────────────────────────────────────
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { IUser, AuthResult, AuthUser } from '../models/user.interface';
import { AnimeStatus, ITierList } from '../models/user-anime.interface';
import { GenreScoreMap } from '../models/anime-list.interface';

// ── LocalStorage keys ─────────────────────────────────────────

/** Key for the list of all registered accounts. */
const KEY_USERS = 'anime-cat-users';
/** Key for the currently signed-in user. */
const KEY_CURRENT = 'anime-cat-current-user';
/** Key for genre affinity scores (Swipe system). */
const KEY_GENRES = 'anime-cat-genre-scores';
/** Key for rejected anime IDs in Swipe. */
const KEY_REJECTED = 'anime-cat-rejected';

// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class StorageService {
  /**
   * Local persistence service for the application.
   * - handles local authentication (register/login/logout)
   * - stores and updates user anime status values
   * - exposes `animeStatusChanged$` for UI synchronization
   * - stores genre scores and rejected anime IDs for Swipe
   */
  private readonly router = inject(Router);

  /**
   * Internal subject emitted whenever an anime status changes.
   * This allows subscribed components to refresh without polling.
   */
  private readonly statusChanged$ = new Subject<void>();

  /** Public observable used by components to react to status updates. */
  readonly animeStatusChanged$: Observable<void> = this.statusChanged$.asObservable();

  constructor() {
    // Install a one-time patch to also propagate cross-tab changes.
    this.patchStorageEvents();
  }

  // ── Authentication ─────────────────────────────────────

  /**
   * Creates a new user account.
   * Validates unique username and email before persisting.
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
   * Authenticates an existing user with email and password.
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

  /** Signs out the current user and redirects to the home page. */
  logout(): void {
    localStorage.removeItem(KEY_CURRENT);
    this.router.navigate(['/']);
  }

  /** Returns `true` when a user session exists. */
  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  /** Returns the current user, or `null` if no session is active. */
  getCurrentUser(): IUser | null {
    const raw = localStorage.getItem(KEY_CURRENT);
    return raw ? (JSON.parse(raw) as IUser) : null;
  }

  // ── Anime status management ──────────────────────────

  /**
   * Adds or updates an anime status for the signed-in user.
   * If the anime already exists in the list, status is overwritten.
   * Otherwise, a new entry is created.
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
   * Removes an anime from the user list (all statuses).
   */
  removeAnime(animeId: number): void {
    const user = this.getCurrentUser();
    if (!user) return;

    user.animeList = user.animeList.filter((a) => a.animeId !== animeId);
    this.persistCurrentUser(user);
  }

  /**
   * Returns the current status for an anime, or `null` when absent.
   */
  getAnimeStatus(mal_id: number): AnimeStatus | null {
    return this.getCurrentUser()?.animeList.find((a) => a.animeId === mal_id)?.status ?? null;
  }

  /**
   * Moves an anime into a tier rank (S/A/B/C), or removes it from tiering.
   * Returns both previous and next rank so the UI can apply score deltas.
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

  // ── Genre scores (Swipe) ──────────────────────────────

  /**
   * Returns the genre affinity score map.
   * Key = MAL genre id, value = score (can be negative).
   */
  getGenreScores(): GenreScoreMap {
    const raw = localStorage.getItem(KEY_GENRES);
    return raw ? (JSON.parse(raw) as GenreScoreMap) : {};
  }

  /**
   * Applies score deltas to the existing genre map.
   * @param deltas Object of { genreId: delta } values.
   */
  applyGenreDeltas(deltas: GenreScoreMap): void {
    const scores = this.getGenreScores();
    Object.entries(deltas).forEach(([k, v]) => {
      scores[Number(k)] = (scores[Number(k)] ?? 0) + v;
    });
    localStorage.setItem(KEY_GENRES, JSON.stringify(scores));
  }

  // ── Rejected anime IDs (Swipe) ────────────────────────────────

  /** Adds an anime ID to the rejected list used by Swipe. */
  addRejected(animeId: number): void {
    const list = this.getRejected();
    if (!list.includes(animeId)) {
      list.push(animeId);
      localStorage.setItem(KEY_REJECTED, JSON.stringify(list));
    }
  }

  /** Removes an anime ID from the rejected list (used by undo). */
  removeRejected(animeId: number): void {
    const filtered = this.getRejected().filter((id) => id !== animeId);
    localStorage.setItem(KEY_REJECTED, JSON.stringify(filtered));
  }

  /** Returns all rejected anime IDs. */
  getRejected(): number[] {
    const raw = localStorage.getItem(KEY_REJECTED);
    return raw ? (JSON.parse(raw) as number[]) : [];
  }

  // ── Private helpers ──────────────────────────────────────

  /** Returns all registered users. */
  private getUsers(): IUser[] {
    const raw = localStorage.getItem(KEY_USERS);
    return raw ? (JSON.parse(raw) as IUser[]) : [];
  }

  /**
   * Persists the current user in LocalStorage and updates
   * the global users list, then emits a change notification.
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
   * One-time patch on Storage.prototype to emit custom events
   * when AnimeCat-related keys change.
   * Enables synchronization across browser tabs.
   * The __animeCatStoragePatched guard prevents duplicate patching.
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
