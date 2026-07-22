import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from '../button/button';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { AnimeStatus } from '../../models/user-anime.interface';

@Component({
  selector: 'app-anime-actions',
  standalone: true,
  imports: [CommonModule, Button],
  templateUrl: './anime-actions.html',
  styleUrl: './anime-actions.scss',
})
export class AnimeActions {
  /**
   * Composant d'actions d'une carte (boutons Plan/Seen).
   * Vérifie l'authentification via `StorageService` avant toute modification.
   */
  @Input() animeId?: number | null;
  @Input() status: AnimeStatus | null = null;

  constructor(
    private storage: StorageService,
    private notify: NotificationService,
  ) {}

  private ensureAuth(): boolean {
    if (!this.storage.isAuthenticated()) {
      this.notify.show('Vous devez être connecté pour ajouter un anime à votre liste.', true);
      return false;
    }
    return true;
  }

  togglePlan(): void {
    if (!this.animeId || !this.ensureAuth()) return;
    const current = this.storage.getAnimeStatus(this.animeId);
    if (current === 'plan_to_watch') this.storage.removeAnime(this.animeId);
    else this.storage.updateAnimeStatus(this.animeId, 'plan_to_watch');
  }

  toggleSeen(): void {
    if (!this.animeId || !this.ensureAuth()) return;
    const current = this.storage.getAnimeStatus(this.animeId);
    if (current === 'seen') this.storage.removeAnime(this.animeId);
    else this.storage.updateAnimeStatus(this.animeId, 'seen');
  }
}
