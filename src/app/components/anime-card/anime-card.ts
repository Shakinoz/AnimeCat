import { Component, computed, input, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnimeStatus, HomeAnime } from '../../models/user-anime.interface';
import { SlicePipe } from '@angular/common';
import { Button } from '../button/button';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-anime-card',
  standalone: true,
  imports: [RouterLink, SlicePipe, Button],
  templateUrl: './anime-card.html',
  styleUrl: './anime-card.scss',
})
export class AnimeCard implements OnInit, OnDestroy {
  public anime = input<HomeAnime>();
  private readonly localStatus = signal<AnimeStatus | null>(null);
  private readonly subscription = new Subscription();
  readonly visibleStatus = computed(() => this.localStatus() ?? this.anime()?.userStatus ?? null);

  constructor(
    private storageService: StorageService,
    private notificationService: NotificationService,
  ) {}

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
