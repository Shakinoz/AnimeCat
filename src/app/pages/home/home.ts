import { Component, signal, WritableSignal, OnInit, OnDestroy, inject } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { TenraiService } from '../../services/tenrai.service';
import { SlicePipe } from '@angular/common';
import { Header } from '../../components/header/header';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { TRENDING_DATA as trendingData } from '../../data/trending-data';
import { Button } from '../../components/button/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StorageService } from '../../services/storage.service';
import { RouterLink } from '@angular/router';
import { AnimeStatus, HomeAnime } from '../../models/user-anime.interface';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { NotificationService } from '../../services/notification.service';
import { catchError, forkJoin, map, of, Subscription } from 'rxjs';
import { AnimeRecommendationService } from '../../services/anime-recommendation.service';
import { Carousel } from '../../components/carousel/carousel';

@Component({
  selector: 'app-home',
  imports: [SlicePipe, Header, Button, MatProgressSpinnerModule, RouterLink, AnimeCard, Carousel],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage implements OnInit, OnDestroy {
  /**
   * Page Home — tableau de bord présentant les sections de découverte.
   *
   * Responsabilités principales :
   * - charger les listes dédiées à l'accueil via le service Tenrai,
   * - enrichir les animes avec leur statut utilisateur,
   * - gérer la navigation du hero et des carrousels.
   */
  private readonly tenrai = inject(TenraiService);
  private readonly storageService = inject(StorageService);
  private readonly notificationService = inject(NotificationService);
  private readonly recommendationService = inject(AnimeRecommendationService);

  trending: WritableSignal<HomeAnime[]> = signal([]);
  popular: WritableSignal<HomeAnime[]> = signal([]);
  recommendations: WritableSignal<HomeAnime[]> = signal([]);
  isRecommendationsLoading = signal(false);
  isLoading = signal(true);
  private readonly statusSubscription = new Subscription();

  heroAnime?: HomeAnime;
  heroIndex = 0;

  get heroDots() {
    return Array.from({ length: this.trending().length }, (_, index) => index);
  }

  constructor() {
    this.loadData();
  }

  ngOnInit(): void {
    // Met à jour les statuts visuels quand la liste d'animes change côté stockage.
    this.statusSubscription.add(
      this.storageService.animeStatusChanged$.subscribe(() => {
        this.refreshHeroAndLists();
      }),
    );
  }

  ngOnDestroy(): void {
    this.statusSubscription.unsubscribe();
  }

  loadData(): void {
    this.loadTrendingData();
    this.loadPopularData();
  }

  private loadTrendingData(): void {
    this.tenrai.getTopAiring(1, 18).subscribe({
      next: (res) => {
        this.trending.set(this.addUserStatus(res.data));
        this.heroAnime = this.trending()[0];
      },
      error: () => {
        this.trending.set(this.addUserStatus(trendingData.data as unknown as Anime[]));
        this.heroAnime = this.trending()[0];
      },
    });
  }

  private loadPopularData(): void {
    this.tenrai.getMostPopular(1, 18).subscribe({
      next: (res) => {
        this.popular.set(this.addUserStatus(res.data));
        this.isLoading.set(false);
        this.loadRecommendationCarousel();
      },
      error: () => {
        this.popular.set(this.addUserStatus(popularData.data as unknown as Anime[]));
        this.isLoading.set(false);
        this.loadRecommendationCarousel();
      },
    });
  }

  // Hero section: cycle through the featured anime list.
  nextHero(): void {
    this.heroIndex = (this.heroIndex + 1) % this.trending().length;
    this.heroAnime = this.trending()[this.heroIndex];
  }

  prevHero(): void {
    this.heroIndex = (this.heroIndex - 1 + this.trending().length) % this.trending().length;
    this.heroAnime = this.trending()[this.heroIndex];
  }

  setHeroIndex(index: number): void {
    this.heroIndex = index;
    this.heroAnime = this.trending()[index];
  }

  cover(anime: Anime) {
    return this.tenrai.getCoverUrl(anime);
  }

  title(anime: Anime) {
    return this.tenrai.getDisplayTitle(anime);
  }

  genres(anime: Anime) {
    return this.tenrai.getGenresLabel(anime);
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

    this.refreshHeroAndLists();
  }

  private refreshHeroAndLists(): void {
    // Réapplique le statut utilisateur aux listes affichées sans recharger les données.
    const refreshStatus = (anime: HomeAnime) => ({
      ...anime,
      userStatus: this.storageService.getAnimeStatus(anime.mal_id) ?? null,
    });

    this.trending.update((list) => list.map((anime) => refreshStatus(anime)));
    this.popular.update((list) => list.map((anime) => refreshStatus(anime)));
    this.recommendations.update((list) => list.map((anime) => refreshStatus(anime)));

    if (this.heroAnime) {
      this.heroAnime = refreshStatus(this.heroAnime);
    }
  }

  private addUserStatus(animes: Anime[]): HomeAnime[] {
    return animes.map((anime) => ({
      ...anime,
      userStatus: this.storageService.getAnimeStatus(anime.mal_id) ?? null,
    }));
  }

  private loadRecommendationCarousel(): void {
    // Génère la section des recommandations à partir du profil utilisateur et des scores.
    const currentUser = this.storageService.getCurrentUser();
    if (!currentUser) {
      this.recommendations.set([]);
      return;
    }

    currentUser.tierList ??= { S: [], A: [], B: [], C: [] };

    const swipeGenreScores = this.storageService.getGenreScores();
    const rejectedIds = new Set(this.storageService.getRejected());

    const topGenreIds = Object.entries(swipeGenreScores)
      .map(([genreId, score]) => ({ genreId: Number(genreId), score }))
      .filter((entry) => entry.genreId > 0 && entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => entry.genreId);

    const hasTierSignals =
      this.recommendationService.getTierAnimeIds(currentUser.tierList).length > 0;
    if (!topGenreIds.length && !hasTierSignals) {
      this.recommendations.set([]);
      return;
    }

    this.isRecommendationsLoading.set(true);

    const genreCombos = this.recommendationService.buildGenreCombinations(topGenreIds);
    const tierAnimeIds = this.recommendationService.getTierAnimeIds(currentUser.tierList);

    const tierAnimes$ = tierAnimeIds.length
      ? this.tenrai.getByIds(tierAnimeIds, false, 2).pipe(catchError(() => of([] as Anime[])))
      : of([] as Anime[]);

    const candidates$ = genreCombos.length
      ? forkJoin(
          genreCombos.map((combo) =>
            this.tenrai.getByGenres(combo, 1, 25).pipe(
              map((result) => result.data),
              catchError(() => of([] as Anime[])),
            ),
          ),
        ).pipe(
          map((groups) => groups.flat()),
          map((animes) => this.recommendationService.dedupeAnimes(animes)),
        )
      : this.tenrai.getMostPopular(1, 100).pipe(
          map((result) => this.recommendationService.dedupeAnimes(result.data)),
          catchError(() =>
            of(
              this.recommendationService.dedupeAnimes(
                (popularData.data as unknown as Anime[]) ?? [],
              ),
            ),
          ),
        );

    forkJoin({ tierAnimes: tierAnimes$, candidates: candidates$ }).subscribe({
      next: ({ tierAnimes, candidates }) => {
        const enrichedCandidates = this.recommendationService.dedupeAnimes([
          ...candidates,
          ...this.trending(),
          ...this.popular(),
          ...((popularData.data as unknown as Anime[]) ?? []),
        ]);

        const ranked = this.recommendationService.generateTopRecommendations(
          {
            currentUser,
            tierAnimes,
            candidates: enrichedCandidates,
            swipeGenreScores,
            rejectedIds,
          },
          18,
        );

        this.recommendations.set(this.addUserStatus(ranked.map((entry) => entry.anime)));
        this.isRecommendationsLoading.set(false);
      },
      error: () => {
        this.recommendations.set([]);
        this.isRecommendationsLoading.set(false);
      },
    });
  }
}
