import { IUser } from './../models/user.interface';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { AnimeStatus } from '../models/user-anime.interface';

type AuthUser = Pick<IUser, 'username' | 'email' | 'password'>;

interface AuthResult {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storageKey = 'anime-cat-users';
  private readonly currentUserKey = 'anime-cat-current-user';
  private readonly router = inject(Router);
  private readonly animeStatusChangedSubject = new Subject<void>();
  readonly animeStatusChanged$: Observable<void> = this.animeStatusChangedSubject.asObservable();

  constructor() {
    this.patchStorageEvents();
  }

  register(user: AuthUser): AuthResult {
    const users = this.getUsers();

    if (
      users.some((storedUser) => storedUser.username.toLowerCase() === user.username.toLowerCase())
    ) {
      return { success: false, message: 'Pseudo déjà utilisé' };
    }

    if (users.some((storedUser) => storedUser.email.toLowerCase() === user.email.toLowerCase())) {
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

    localStorage.setItem(this.storageKey, JSON.stringify(users));
    localStorage.setItem(this.currentUserKey, JSON.stringify(newUser));

    return { success: true, message: 'Compte créé avec succès' };
  }

  login(credentials: Pick<AuthUser, 'email' | 'password'>): AuthResult {
    const users = this.getUsers();
    const user = users.find(
      (storedUser) => storedUser.email.toLowerCase() === credentials.email.trim().toLowerCase(),
    );

    if (!user) {
      return { success: false, message: 'Aucun compte trouvé pour cet email' };
    }

    if (user.password !== credentials.password) {
      return { success: false, message: 'Mot de passe incorrect' };
    }

    localStorage.setItem(this.currentUserKey, JSON.stringify(user));

    return { success: true, message: 'Connexion réussie' };
  }

  logout(): void {
    localStorage.removeItem(this.currentUserKey);
    this.router.navigate(['/']);
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  getCurrentUser(): IUser | null {
    const value = localStorage.getItem(this.currentUserKey);
    return value ? (JSON.parse(value) as IUser) : null;
  }

  private getUsers(): IUser[] {
    const value = localStorage.getItem(this.storageKey);
    return value ? (JSON.parse(value) as IUser[]) : [];
  }

  private saveCurrentUser(user: IUser): void {
    localStorage.setItem(this.currentUserKey, JSON.stringify(user));

    const users = this.getUsers();
    const index = users.findIndex((u) => u.email === user.email);

    if (index !== -1) {
      users[index] = user;
      localStorage.setItem(this.storageKey, JSON.stringify(users));
    }

    this.notifyStatusChanged();
  }

  updateAnimeStatus(animeId: number, status: AnimeStatus): void {
    const user = this.getCurrentUser();

    if (!user) return;

    const anime = user.animeList.find((a) => a.animeId === animeId);

    if (anime) {
      anime.status = status;
    } else {
      user.animeList.push({
        animeId,
        status,
      });
    }

    this.saveCurrentUser(user);
  }

  removeAnime(animeId: number): void {
    const user = this.getCurrentUser();

    if (!user) return;

    user.animeList = user.animeList.filter((a) => a.animeId !== animeId);

    this.saveCurrentUser(user);
  }

  private notifyStatusChanged(): void {
    this.animeStatusChangedSubject.next();
  }

  private patchStorageEvents(): void {
    const relevantKeys = new Set([this.storageKey, this.currentUserKey]);
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    const hasAlreadyPatched = (window as Window & { __animeCatStoragePatched?: boolean })
      .__animeCatStoragePatched;
    if (hasAlreadyPatched) {
      return;
    }

    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      const result = originalSetItem.call(this, key, value);
      if (relevantKeys.has(key)) {
        window.dispatchEvent(new CustomEvent('anime-cat-storage-changed', { detail: { key } }));
      }
      return result;
    };

    Storage.prototype.removeItem = function (this: Storage, key: string) {
      const result = originalRemoveItem.call(this, key);
      if (relevantKeys.has(key)) {
        window.dispatchEvent(new CustomEvent('anime-cat-storage-changed', { detail: { key } }));
      }
      return result;
    };

    window.addEventListener('anime-cat-storage-changed', () => {
      this.notifyStatusChanged();
    });
    window.addEventListener('storage', () => {
      this.notifyStatusChanged();
    });

    (window as Window & { __animeCatStoragePatched?: boolean }).__animeCatStoragePatched = true;
  }

  getAnimeStatus(mal_id: number): AnimeStatus | null {
    const user = this.getCurrentUser();

    return user?.animeList.find((anime) => anime.animeId === mal_id)?.status ?? null;
  }
}
