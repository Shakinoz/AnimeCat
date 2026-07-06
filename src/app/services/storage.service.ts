import { Injectable } from '@angular/core';

interface AuthUser {
  username: string;
  email: string;
  password: string;
}

interface AuthResult {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storageKey = 'anime-cat-users';
  private readonly currentUserKey = 'anime-cat-current-user';

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

    users.push({
      username: user.username.trim(),
      email: user.email.trim().toLowerCase(),
      password: user.password,
    });

    localStorage.setItem(this.storageKey, JSON.stringify(users));
    localStorage.setItem(this.currentUserKey, JSON.stringify(users[users.length - 1]));

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
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  getCurrentUser(): AuthUser | null {
    const value = localStorage.getItem(this.currentUserKey);
    return value ? JSON.parse(value) : null;
  }

  private getUsers(): AuthUser[] {
    const value = localStorage.getItem(this.storageKey);
    return value ? (JSON.parse(value) as AuthUser[]) : [];
  }
}
