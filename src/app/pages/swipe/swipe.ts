import { Component, signal } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { DeviceDetectorService } from 'ngx-device-detector';
import { catchError, forkJoin, map, of } from 'rxjs';
import { TenraiService } from '../../services/tenrai.service';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import {
  AnimeRecommendationService,
  RecommendationResult,
} from '../../services/anime-recommendation.service';
import { Anime } from '@tutkli/jikan-ts';
import { Header } from '../../components/header/header';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { Button } from '../../components/button/button';
import { CdkDrag, CdkDragEnd, CdkDragMove } from '@angular/cdk/drag-drop';
import { AnimeCard } from '../../components/anime-card/anime-card';

@Component({
  selector: 'app-swipe',
  standalone: true,
  imports: [CommonModule, Header, MatProgressSpinner, Button, CdkDrag, SlicePipe, AnimeCard],
  templateUrl: './swipe.html',
  styleUrl: './swipe.scss',
})
/**
 * Swipe page for gesture-based anime discovery.
 *
 * Behavior:
 * - like (right)    : marks anime and boosts related genre scores
 * - dislike (left)  : rejects anime and decreases related genre scores
 * - skip (up)       : neutral action with no score update
 * - undo            : reverts the last action and its side effects
 */
export class SwipePage {
  /**
   * Gesture thresholds and visual tilt constants.
   * Desktop and mobile values are split for better ergonomics.
   */
  private static readonly DT_DRAG_X_THRESHOLD = 230;
  private static readonly DT_DRAG_Y_THRESHOLD = -75;
  private static readonly MB_DRAG_X_THRESHOLD = 100;
  private static readonly MB_DRAG_Y_THRESHOLD = -50;
  private static readonly DT_MAX_TILT_DEG = 14;
  private static readonly MB_MAX_TILT_DEG = 10;

  animes: Anime[] = [];
  currentIndex = 0;

  finished = signal(false);
  isLoading = signal(false);
  isMobile = signal(false);
  infoVisible = signal(false);
  dragRotation = signal(0);
  isBuildingRecommendations = signal(false);
  recommendations = signal<RecommendationResult | null>(null);
  private lastAppliedRotation = 0;

  // Action history used to support undo (last action at the end).
  private history: Array<{
    action: 'like' | 'dislike' | 'skip';
    animeId: number;
    genreDeltas: Record<number, number>;
  }> = [];

  constructor(
    private readonly tenrai: TenraiService,
    private readonly storage: StorageService,
    private readonly notify: NotificationService,
    private readonly recommendationService: AnimeRecommendationService,
    private readonly detectionService: DeviceDetectorService,
  ) {
    this.isMobile.set(this.detectionService.isMobile());
    this.loadAnimes();
  }

  /** Returns cover URL for the current anime card context. */
  cover(anime: Anime | null): string {
    if (!anime) return 'assets/img/placeholder.webp';
    return this.tenrai.getCoverUrl(anime);
  }

  /** Returns the number of actions currently stored in history. */

  get historyLength(): number {
    return this.history.length;
  }

  /** Returns a compact genres label for card rendering. */
  genresLabel(anime: Anime | null): string {
    if (!anime) return '';
    return this.tenrai.getGenresLabel(anime, 4);
  }

  onCardDragged(event: CdkDragMove): void {
    // Translate horizontal drag into card tilt for immediate visual feedback.
    const { x } = event.source.getFreeDragPosition();
    const threshold = this.getDragXThreshold();
    const maxTilt = this.isMobile() ? SwipePage.MB_MAX_TILT_DEG : SwipePage.DT_MAX_TILT_DEG;

    // Normalize x between -1 and 1 to keep tilt progressive and bounded.
    const ratio = Math.max(-1, Math.min(1, x / threshold));
    const nextRotation = ratio * maxTilt;

    // Avoid unnecessary renders for imperceptible angle changes.
    if (Math.abs(nextRotation - this.lastAppliedRotation) < 0.25) return;

    this.lastAppliedRotation = nextRotation;
    this.dragRotation.set(nextRotation);
  }

  onCardDragEnded(event: CdkDragEnd): void {
    // Reset card position and trigger action when thresholds are crossed.
    const { x, y } = event.source.getFreeDragPosition();
    const dragXThreshold = this.getDragXThreshold();
    const dragYThreshold = this.getDragYThreshold();

    // Always reset card to origin, even if no action is triggered.
    event.source.reset();
    this.lastAppliedRotation = 0;
    this.dragRotation.set(0);

    // Trigger corresponding action based on horizontal/vertical threshold.
    if (x >= dragXThreshold) {
      this.like();
      return;
    }

    if (x <= -dragXThreshold) {
      this.dislike();
      return;
    }

    if (y <= dragYThreshold) {
      this.skip();
    }
  }

  /** Returns horizontal drag threshold based on current device form factor. */
  private getDragXThreshold(): number {
    return this.isMobile() ? SwipePage.MB_DRAG_X_THRESHOLD : SwipePage.DT_DRAG_X_THRESHOLD;
  }

  /** Returns vertical drag threshold based on current device form factor. */
  private getDragYThreshold(): number {
    return this.isMobile() ? SwipePage.MB_DRAG_Y_THRESHOLD : SwipePage.DT_DRAG_Y_THRESHOLD;
  }

  private loadAnimes(): void {
    // Initial load uses popular anime, then shuffles for natural card variety.
    this.isLoading.set(true);
    this.finished.set(false);
    this.recommendations.set(null);

    this.tenrai.getMostPopular(1, 100).subscribe({
      next: (res) => {
        const source = res.data?.length
          ? res.data
          : ((popularData.data as unknown as Anime[]) ?? []);

        this.animes = this.shuffleAnimes(source);
        this.currentIndex = 0;

        if (!res.data?.length) {
          this.notify.show('API unavailable: local popular list loaded.', false);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Swipe load error', err);
        this.animes = this.shuffleAnimes((popularData.data as unknown as Anime[]) ?? []);
        this.currentIndex = 0;
        this.notify.show('API unavailable: local popular list loaded.', false);
        this.isLoading.set(false);
      },
    });
  }

  private shuffleAnimes(list: Anime[]): Anime[] {
    // Shuffle list to avoid repetitive ordering between sessions.
    const shuffled = [...list];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /** Returns the currently displayed anime, or null when exhausted. */
  get currentAnime(): Anime | null {
    return this.animes[this.currentIndex] ?? null;
  }

  /** Extracts MAL genre IDs from an anime payload. */
  private getGenreIds(anime: Anime): number[] {
    return (anime.genres ?? [])
      .map((g: any) => g.mal_id ?? g.id ?? -1)
      .filter((id: number) => id > 0);
  }

  like(): void {
    // Like is a positive signal: save anime and reward related genres.
    const anime = this.currentAnime;
    if (!anime || this.finished()) return;

    const genreIds = this.getGenreIds(anime);
    const deltas: Record<number, number> = {};
    genreIds.forEach((id) => (deltas[id] = (deltas[id] ?? 0) + 1));

    // Persist anime status and apply positive genre deltas.
    this.storage.updateAnimeStatus(anime.mal_id, 'seen');
    this.storage.applyGenreDeltas(deltas);

    this.history.push({ action: 'like', animeId: anime.mal_id, genreDeltas: deltas });
    this.nextCard();
    this.notify.show('Animé ajouté', false);
  }

  dislike(): void {
    // Dislike is a negative signal: penalize genres and reject anime.
    const anime = this.currentAnime;
    if (!anime || this.finished()) return;

    const genreIds = this.getGenreIds(anime);
    const deltas: Record<number, number> = {};
    genreIds.forEach((id) => (deltas[id] = (deltas[id] ?? 0) - 1));

    // Persist rejected flag and apply negative genre deltas.
    this.storage.updateAnimeStatus(anime.mal_id, 'seen');
    this.storage.addRejected(anime.mal_id);
    this.storage.applyGenreDeltas(deltas);

    this.history.push({ action: 'dislike', animeId: anime.mal_id, genreDeltas: deltas });
    this.nextCard();
    this.notify.show('Animé écarté', false);
  }

  skip(): void {
    // Skip is neutral: move to next card without profile updates.
    const anime = this.currentAnime;
    if (!anime) return;

    this.history.push({ action: 'skip', animeId: anime.mal_id, genreDeltas: {} });
    this.nextCard();
  }

  /** Moves to the next card or finishes and builds recommendations. */
  private nextCard(): void {
    if (this.currentIndex < this.animes.length - 1) {
      this.currentIndex++;
    } else {
      this.finished.set(true);
      this.generateRecommendationsFromProfile();
    }
  }

  undo(): void {
    // Undo reverts the latest action by using stored history metadata.
    if (this.history.length === 0) return;

    const last = this.history.pop()!;
    const animeId = last.animeId;
    this.finished.set(false);
    this.recommendations.set(null);

    // Revert previously applied genre deltas.
    const inverse: Record<number, number> = {};
    Object.entries(last.genreDeltas).forEach(([k, v]) => {
      inverse[Number(k)] = -v;
    });
    this.storage.applyGenreDeltas(inverse);

    // Restore previous persisted state (watchlist/rejected flags).
    if (last.action === 'like') {
      this.storage.removeAnime(animeId);
    } else if (last.action === 'dislike') {
      this.storage.removeRejected(animeId);
    }

    // Move back to previous card when possible.
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }

    this.notify.show('Action annulée', false);
  }

  /**
   * Returns recommendation score formatted for UI display.
   */
  recommendationScore(score: number | undefined): string {
    if (score === undefined || Number.isNaN(score)) return '-';
    return score.toFixed(1);
  }

  /**
   * Generates final recommendations using the recommendation pipeline:
   * 1) build preference profile (swipe scores + tier list)
   * 2) load Tenrai candidates from genre combinations
   * 3) score and select safest, popular, and discovery picks
   */
  private generateRecommendationsFromProfile(): void {
    // Build recommendation profile after the swipe deck is exhausted.
    if (this.isBuildingRecommendations()) return;

    const currentUser = this.storage.getCurrentUser();
    if (!currentUser) {
      this.notify.show('Sign in to generate personalized recommendations.', true);
      return;
    }

    this.isBuildingRecommendations.set(true);

    const swipeGenreScores = this.storage.getGenreScores();
    const rejectedIds = new Set(this.storage.getRejected());

    // Focus on strongest positive genres to build query combinations.
    const topGenreIds = Object.entries(swipeGenreScores)
      .map(([genreId, score]) => ({ genreId: Number(genreId), score }))
      .filter((entry) => entry.genreId > 0 && entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => entry.genreId);

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
      : this.tenrai.getMostPopular(1, 80).pipe(
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
        // Enrich candidate pool with already loaded swipe items when needed.
        const enrichedCandidates = this.recommendationService.dedupeAnimes([
          ...candidates,
          ...this.animes,
        ]);

        const result = this.recommendationService.generateRecommendations({
          currentUser,
          tierAnimes,
          candidates: enrichedCandidates,
          swipeGenreScores,
          rejectedIds,
        });

        this.recommendations.set(result);
        this.isBuildingRecommendations.set(false);

        if (result.safestChoice || result.popularChoice || result.discovery) {
          this.notify.show('Recommendations generated successfully.', false);
        } else {
          this.notify.show('Not enough candidates to generate recommendations.', true);
        }

        console.log('Recommendations result', result);
      },
      error: (err) => {
        console.error('Recommendation generation error', err);
        this.isBuildingRecommendations.set(false);
        this.notify.show('Unable to generate recommendations right now.', true);
      },
    });
  }
}
