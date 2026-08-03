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
   * Card action component (Plan/Seen buttons).
   * Checks authentication through `StorageService` before updates.
   */
  @Input() animeId?: number | null;
  @Input() status: AnimeStatus | null = null;

  constructor(
    private storage: StorageService,
    private notify: NotificationService,
  ) {}

  /** Returns `true` when action can continue for authenticated users. */
  private ensureAuth(): boolean {
    if (!this.storage.isAuthenticated()) {
      this.notify.show('Vous devez être connecté pour ajouter un anime à votre liste.', true);
      return false;
    }
    return true;
  }

  /** Toggles `plan_to_watch` status for the current anime. */
  togglePlan(): void {
    if (!this.animeId || !this.ensureAuth()) return;
    const current = this.storage.getAnimeStatus(this.animeId);
    if (current === 'plan_to_watch') this.storage.removeAnime(this.animeId);
    else this.storage.updateAnimeStatus(this.animeId, 'plan_to_watch');
  }

  /** Toggles `seen` status for the current anime. */
  toggleSeen(): void {
    if (!this.animeId || !this.ensureAuth()) return;
    const current = this.storage.getAnimeStatus(this.animeId);
    if (current === 'seen') this.storage.removeAnime(this.animeId);
    else this.storage.updateAnimeStatus(this.animeId, 'seen');
  }
}
