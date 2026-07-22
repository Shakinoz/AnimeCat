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
   * Composant `AnimeCard` — affiche une carte réutilisable pour un anime.
   * - expose des helpers `title`, `cover()` et `genresShort()` pour le template
   * - synchronise le statut utilisateur via `StorageService` et `animeStatusChanged$`
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

  /** Affiche le titre utilisable dans le template (anglais en priorité). */

  ngOnInit(): void {
    this.refreshStatus();
    this.subscription.add(
      this.storageService.animeStatusChanged$.subscribe(() => this.refreshStatus()),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  title = computed(() => this.anime()?.title_english?.trim() || this.anime()?.title || '');

  /** Retourne l'URL de couverture canonique via TenraiService. */
  cover(): string {
    const a = this.anime();
    return a ? this.tenrai.getCoverUrl(a) : 'assets/img/placeholder.webp';
  }

  /** Retourne une chaîne de genres limitée pour l'affichage compact. */
  genresShort(max = 2): string {
    const a = this.anime();
    return a ? this.tenrai.getGenresLabel(a, max) : '';
  }

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

  private refreshStatus(): void {
    const animeId = this.anime()?.mal_id;
    if (!animeId) {
      this.localStatus.set(null);
      return;
    }

    this.localStatus.set(this.storageService.getAnimeStatus(animeId));
  }
}
