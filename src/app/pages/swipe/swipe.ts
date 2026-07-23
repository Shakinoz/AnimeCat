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
import { ITierList } from '../../models/user-anime.interface';

@Component({
  selector: 'app-swipe',
  standalone: true,
  imports: [CommonModule, Header, MatProgressSpinner, Button, CdkDrag, SlicePipe],
  templateUrl: './swipe.html',
  styleUrl: './swipe.scss',
})
/**
 * Page Swipe — interface de découverte d'animés par gestes.
 *
 * Comportement :
 * - like (droite)  : enregistre l'anime en `plan_to_watch` et augmente les scores des genres
 * - dislike (gauche): marque l'anime comme rejeté et diminue les scores des genres
 * - skip (haut)     : neutre, ne modifie pas les scores
 * - undo            : annule la dernière action et inverse ses effets
 */
export class SwipePage {
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

  // Historique des actions pour permettre l'annulation (dernière action à la fin)
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

  cover(anime: Anime | null): string {
    if (!anime) return 'assets/img/placeholder.webp';
    return this.tenrai.getCoverUrl(anime);
  }

  /** Charge une première liste d'animes pour le swipe depuis les populaires. */

  get historyLength(): number {
    return this.history.length;
  }

  genresLabel(anime: Anime | null): string {
    if (!anime) return '';
    return this.tenrai.getGenresLabel(anime, 4);
  }

  onCardDragged(event: CdkDragMove): void {
    const { x } = event.source.getFreeDragPosition();
    const threshold = this.getDragXThreshold();
    const maxTilt = this.isMobile() ? SwipePage.MB_MAX_TILT_DEG : SwipePage.DT_MAX_TILT_DEG;

    // Normalise x entre -1 et 1 pour garder une inclinaison progressive et bornée.
    const ratio = Math.max(-1, Math.min(1, x / threshold));
    const nextRotation = ratio * maxTilt;

    // Evite de déclencher trop de rendus pour des variations imperceptibles.
    if (Math.abs(nextRotation - this.lastAppliedRotation) < 0.25) return;

    this.lastAppliedRotation = nextRotation;
    this.dragRotation.set(nextRotation);
  }

  onCardDragEnded(event: CdkDragEnd): void {
    const { x, y } = event.source.getFreeDragPosition();
    const dragXThreshold = this.getDragXThreshold();
    const dragYThreshold = this.getDragYThreshold();

    // Repositionne toujours la carte a son point initial, meme sans action.
    event.source.reset();
    this.lastAppliedRotation = 0;
    this.dragRotation.set(0);

    // Si la carte a été déplacée suffisamment à droite, gauche ou haut, déclenche l'action correspondante.
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

  private getDragXThreshold(): number {
    return this.isMobile() ? SwipePage.MB_DRAG_X_THRESHOLD : SwipePage.DT_DRAG_X_THRESHOLD;
  }

  private getDragYThreshold(): number {
    return this.isMobile() ? SwipePage.MB_DRAG_Y_THRESHOLD : SwipePage.DT_DRAG_Y_THRESHOLD;
  }

  private loadAnimes(): void {
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
          this.notify.show('API indisponible: liste populaire locale chargee.', false);
        }

        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Swipe load error', err);
        this.animes = this.shuffleAnimes((popularData.data as unknown as Anime[]) ?? []);
        this.currentIndex = 0;
        this.notify.show('API indisponible: liste populaire locale chargee.', false);
        this.isLoading.set(false);
      },
    });
  }

  private shuffleAnimes(list: Anime[]): Anime[] {
    const shuffled = [...list];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  get currentAnime(): Anime | null {
    return this.animes[this.currentIndex] ?? null;
  }

  /** Extrait les identifiants MAL des genres d'un anime. */
  private getGenreIds(anime: Anime): number[] {
    return (anime.genres ?? [])
      .map((g: any) => g.mal_id ?? g.id ?? -1)
      .filter((id: number) => id > 0);
  }

  like(): void {
    const anime = this.currentAnime;
    if (!anime || this.finished()) return;

    const genreIds = this.getGenreIds(anime);
    const deltas: Record<number, number> = {};
    genreIds.forEach((id) => (deltas[id] = (deltas[id] ?? 0) + 1));

    // Enregistre l'anime et applique les deltas de genres
    this.storage.updateAnimeStatus(anime.mal_id, 'seen');
    this.storage.applyGenreDeltas(deltas);

    this.history.push({ action: 'like', animeId: anime.mal_id, genreDeltas: deltas });
    this.nextCard();
    this.notify.show('Animé ajouté', false);
  }

  dislike(): void {
    const anime = this.currentAnime;
    if (!anime || this.finished()) return;

    const genreIds = this.getGenreIds(anime);
    const deltas: Record<number, number> = {};
    genreIds.forEach((id) => (deltas[id] = (deltas[id] ?? 0) - 1));

    // Marque comme rejeté et applique pénalisation des genres
    this.storage.updateAnimeStatus(anime.mal_id, 'seen');
    this.storage.addRejected(anime.mal_id);
    this.storage.applyGenreDeltas(deltas);

    this.history.push({ action: 'dislike', animeId: anime.mal_id, genreDeltas: deltas });
    this.nextCard();
    this.notify.show('Animé écarté', false);
  }

  skip(): void {
    const anime = this.currentAnime;
    if (!anime) return;

    this.history.push({ action: 'skip', animeId: anime.mal_id, genreDeltas: {} });
    this.nextCard();
  }

  private nextCard(): void {
    if (this.currentIndex < this.animes.length - 1) {
      this.currentIndex++;
    } else {
      this.finished.set(true);
      this.generateRecommendationsFromProfile();
    }
  }

  undo(): void {
    if (this.history.length === 0) return;

    const last = this.history.pop()!;
    const animeId = last.animeId;
    this.finished.set(false);
    this.recommendations.set(null);

    // revert genre deltas
    // Inverse les deltas de genres appliqués précédemment
    const inverse: Record<number, number> = {};
    Object.entries(last.genreDeltas).forEach(([k, v]) => {
      inverse[Number(k)] = -v;
    });
    this.storage.applyGenreDeltas(inverse);

    // Restaure l'état antérieur (retire de la watchlist ou retire le rejet)
    if (last.action === 'like') {
      this.storage.removeAnime(animeId);
    } else if (last.action === 'dislike') {
      this.storage.removeRejected(animeId);
    }

    // move back to previous card if possible
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }

    this.notify.show('Action annulée', false);
  }

  /**
   * Retourne le score de recommandation formaté pour l'UI.
   */
  recommendationScore(score: number | undefined): string {
    if (score === undefined || Number.isNaN(score)) return '-';
    return score.toFixed(1);
  }

  /**
   * Génère les recommandations finales en appliquant le pipeline proposé:
   * 1) construire un profil de goûts (scores swipe + tierlist)
   * 2) rechercher des candidats Tenrai à partir de combinaisons de genres
   * 3) scorer et sélectionner: choix sûr, populaire, découverte
   */
  private generateRecommendationsFromProfile(): void {
    if (this.isBuildingRecommendations()) return;

    const currentUser = this.storage.getCurrentUser();
    if (!currentUser) {
      this.notify.show('Connecte-toi pour générer des recommandations personnalisées.', true);
      return;
    }

    this.isBuildingRecommendations.set(true);

    const swipeGenreScores = this.storage.getGenreScores();
    const rejectedIds = new Set(this.storage.getRejected());

    // On se concentre sur les genres positifs les plus forts pour construire les recherches.
    const topGenreIds = Object.entries(swipeGenreScores)
      .map(([genreId, score]) => ({ genreId: Number(genreId), score }))
      .filter((entry) => entry.genreId > 0 && entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => entry.genreId);

    const genreCombos = this.buildGenreCombinations(topGenreIds);
    const tierAnimeIds = this.getTierAnimeIds(currentUser.tierList);

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
          map((animes) => this.dedupeAnimes(animes)),
        )
      : this.tenrai.getMostPopular(1, 80).pipe(
          map((result) => this.dedupeAnimes(result.data)),
          catchError(() => of(this.dedupeAnimes((popularData.data as unknown as Anime[]) ?? []))),
        );

    forkJoin({ tierAnimes: tierAnimes$, candidates: candidates$ }).subscribe({
      next: ({ tierAnimes, candidates }) => {
        // Si le pool est trop faible, on enrichit avec le lot déjà présent dans le swipe.
        const enrichedCandidates = this.dedupeAnimes([...candidates, ...this.animes]);

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
          this.notify.show('Recommandations générées avec succès.', false);
        } else {
          this.notify.show('Pas assez de candidats pour générer des recommandations.', true);
        }

        console.log('Recommendations result', result);
      },
      error: (err) => {
        console.error('Recommendation generation error', err);
        this.isBuildingRecommendations.set(false);
        this.notify.show('Impossible de générer les recommandations pour le moment.', true);
      },
    });
  }

  /**
   * Crée des combinaisons 2 et 3 genres (plus un single de secours) à partir des top genres.
   * Objectif: obtenir des candidats variés sans multiplier trop fortement les appels API.
   */
  private buildGenreCombinations(genreIds: number[]): number[][] {
    if (!genreIds.length) return [];

    const combinations: number[][] = [];
    const unique = [...new Set(genreIds)].filter((id) => id > 0);

    // Combinaisons de 2 genres.
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        combinations.push([unique[i], unique[j]]);
      }
    }

    // Combinaisons de 3 genres pour capturer les affinités plus fines.
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        for (let k = j + 1; k < unique.length; k++) {
          combinations.push([unique[i], unique[j], unique[k]]);
        }
      }
    }

    // Si aucune combinaison n'existe (ex: un seul genre), on fallback sur le genre seul.
    if (!combinations.length) {
      combinations.push([unique[0]]);
    }

    // Déduplication robuste pour éviter les appels API doublons.
    const byKey = new Map<string, number[]>();
    combinations.forEach((combo) => {
      const normalized = [...combo].sort((a, b) => a - b);
      byKey.set(normalized.join(','), normalized);
    });

    return Array.from(byKey.values()).slice(0, 12);
  }

  /**
   * Récupère l'ensemble des IDs présents en tier list (S/A/B/C), sans doublon.
   */
  private getTierAnimeIds(tierList: ITierList): number[] {
    return [
      ...new Set([
        ...(tierList.S ?? []),
        ...(tierList.A ?? []),
        ...(tierList.B ?? []),
        ...(tierList.C ?? []),
      ]),
    ];
  }

  /**
   * Déduplique des animés par MAL ID, en gardant la première occurrence valide.
   */
  private dedupeAnimes(animes: Anime[]): Anime[] {
    const byId = new Map<number, Anime>();

    animes.forEach((anime) => {
      if (!anime?.mal_id) return;
      if (!byId.has(anime.mal_id)) {
        byId.set(anime.mal_id, anime);
      }
    });

    return Array.from(byId.values());
  }
}
