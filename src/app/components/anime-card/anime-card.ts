import { Component, computed, input, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimeStatus, HomeAnime } from '../../models/user-anime.interface';
import { SlicePipe } from '@angular/common';
import { AnimeActions } from '../anime-actions/anime-actions';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { TenraiService } from '../../services/tenrai.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-anime-card',
  standalone: true,
  imports: [RouterLink, SlicePipe, AnimeActions],
  templateUrl: './anime-card.html',
  styleUrl: './anime-card.scss',
})
export class AnimeCard implements OnInit, OnDestroy {
  /**
   * Reusable anime card component.
   * - exposes `title`, `cover()`, and `genresShort()` for the template
   * - keeps user status synchronized through `StorageService`
   */
  public anime = input<HomeAnime>();
  private readonly localStatus = signal<AnimeStatus | null>(null);
  private readonly subscription = new Subscription();
  readonly visibleStatus = computed(() => this.localStatus() ?? this.anime()?.userStatus ?? null);

  constructor(
    private storageService: StorageService,
    private notificationService: NotificationService,
    private tenrai: TenraiService,
  ) {}

  /** Initializes status synchronization for this card instance. */

  ngOnInit(): void {
    this.refreshStatus();
    this.subscription.add(
      this.storageService.animeStatusChanged$.subscribe(() => this.refreshStatus()),
    );
  }

  /** Cleans up active subscriptions when component is destroyed. */
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  /** Preferred display title (English first, fallback to default title). */
  title = computed(() => this.anime()?.title_english?.trim() || this.anime()?.title || '');

  /** Returns canonical cover URL through TenraiService. */
  cover(): string {
    const a = this.anime();
    return a ? this.tenrai.getCoverUrl(a) : 'assets/img/placeholder.webp';
  }

  /** Returns a compact genre label limited to `max` entries. */
  genresShort(max = 2): string {
    const a = this.anime();
    return a ? this.tenrai.getGenresLabel(a, max) : '';
  }

  /** Toggles anime status from card interactions with auth guard. */
  toggleStatus(animeId: number, status: AnimeStatus): void {
    if (!this.storageService.isAuthenticated()) {
      this.notificationService.show(
        'Vous devez être connecté pour ajouter un anime à votre liste.',
        true,
      );
      return;
    }

    const currentStatus = this.storageService.getAnimeStatus(animeId);
    if (currentStatus === status) {
      this.storageService.removeAnime(animeId);
    } else {
      this.storageService.updateAnimeStatus(animeId, status);
    }

    this.refreshStatus();
  }

  /** Recomputes local status from persisted user data. */
  private refreshStatus(): void {
    const animeId = this.anime()?.mal_id;
    if (!animeId) {
      this.localStatus.set(null);
      return;
    }

    this.localStatus.set(this.storageService.getAnimeStatus(animeId));
  }
}
