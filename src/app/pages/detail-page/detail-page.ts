import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import type { Anime } from '@tutkli/jikan-ts';
import { Header } from '../../components/header/header';
import { AnimeActions } from '../../components/anime-actions/anime-actions';
import { TenraiService } from '../../services/tenrai.service';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import type { AnimeStatus } from '../../models/user-anime.interface';
import { Button } from '../../components/button/button';

@Component({
  selector: 'app-detail-page',
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, Header, AnimeActions, Button],
  templateUrl: './detail-page.html',
  styleUrl: './detail-page.scss',
})
export class DetailPage implements OnInit, OnDestroy {
  /**
   * État du détail d'un anime : chargement, erreur, données et statut utilisateur.
   * Les signals évitent la manipulation manuelle du DOM et rendent le template réactif.
   */
  readonly anime = signal<Anime | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly animeStatus = signal<AnimeStatus | null>(null);

  private readonly subscription = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tenrai: TenraiService,
    private readonly storage: StorageService,
    private readonly notification: NotificationService,
  ) {}

  ngOnInit(): void {
    // Réagit au changement de route pour charger l'anime correspondant.
    this.subscription.add(
      this.route.paramMap
        .pipe(
          switchMap((params) => {
            const idParam = params.get('id');
            const id = Number(idParam);

            this.resetViewState();

            if (!idParam || Number.isNaN(id) || id <= 0) {
              this.error.set('Identifiant anime invalide.');
              this.isLoading.set(false);
              return of(null);
            }

            return this.tenrai.getById(id).pipe(
              catchError(() => {
                this.error.set('Impossible de charger cet anime pour le moment.');
                return of(null);
              }),
            );
          }),
        )
        .subscribe((anime) => {
          this.anime.set(anime);
          this.isLoading.set(false);

          if (anime?.mal_id) {
            this.animeStatus.set(this.storage.getAnimeStatus(anime.mal_id));
          }
        }),
    );

    // Met à jour le bouton d'action si l'état utilisateur change en dehors de cette vue.
    this.subscription.add(
      this.storage.animeStatusChanged$.subscribe(() => {
        const animeId = this.anime()?.mal_id;
        if (!animeId) return;
        this.animeStatus.set(this.storage.getAnimeStatus(animeId));
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private resetViewState(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.anime.set(null);
    this.animeStatus.set(null);
  }

  cover(anime: Anime): string {
    return this.tenrai.getCoverUrl(anime);
  }

  title(anime: Anime): string {
    return this.tenrai.getDisplayTitle(anime);
  }

  genres(anime: Anime): string {
    return this.tenrai.getGenresLabel(anime, 6) || 'Genres non disponibles';
  }

  studios(anime: Anime): string {
    if (!anime.studios?.length) return 'Inconnus';
    return anime.studios.map((studio) => studio.name).join(', ');
  }

  allGenres(anime: Anime): string {
    if (!anime.genres?.length) return 'Inconnus';
    return anime.genres.map((genre) => genre.name).join(', ');
  }

  airedLabel(anime: Anime): string {
    const aired = anime.aired as { from?: string | null; to?: string | null } | undefined;

    if (!aired) return 'Inconnue';

    const from = aired.from?.slice(0, 10);
    const to = aired.to?.slice(0, 10);

    if (from && to) return `${from} -> ${to}`;
    if (from) return `Depuis ${from}`;

    return 'Inconnue';
  }

  openExternal(url?: string | null): void {
    if (!url) {
      this.notification.show('Lien indisponible pour cet anime.', true);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
