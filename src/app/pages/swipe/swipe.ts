import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenraiService } from '../../services/tenrai.service';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { Anime } from '@tutkli/jikan-ts';
import { Header } from '../../components/header/header';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { Button } from '../../components/button/button';
import { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-swipe',
  standalone: true,
  imports: [CommonModule, Header, MatProgressSpinner, Button, CdkDrag],
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

  animes: Anime[] = [];
  currentIndex = 0;

  finished = signal(false);
  isLoading = signal(false);
  infoVisible = signal(false);

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
  ) {
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

  onCardDragEnded(event: CdkDragEnd): void {
    const { x, y } = event.source.getFreeDragPosition();

    // Repositionne toujours la carte a son point initial, meme sans action.
    event.source.reset();

    // Si la carte a été déplacée suffisamment à droite, gauche ou haut, déclenche l'action correspondante.
    if (x >= SwipePage.DT_DRAG_X_THRESHOLD) {
      this.like();
      return;
    }

    if (x <= -SwipePage.DT_DRAG_X_THRESHOLD) {
      this.dislike();
      return;
    }

    if (y <= SwipePage.DT_DRAG_Y_THRESHOLD) {
      this.skip();
    }
  }

  private loadAnimes(): void {
    this.isLoading.set(true);
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
      // TODO:
      // appeler la fonction de recommandation des animes sur bases des animes likés et des genres favoris
      console.log('fin de liste voici les datas de tests', this.history);
    }
  }

  undo(): void {
    if (this.history.length === 0) return;

    const last = this.history.pop()!;
    const animeId = last.animeId;

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
}
