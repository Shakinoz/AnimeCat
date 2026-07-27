import { Component, signal, WritableSignal } from '@angular/core';
import { Header } from '../../components/header/header';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { StorageService } from './../../services/storage.service';
import { TenraiService } from '../../services/tenrai.service';
import { HomeAnime, ITierList } from '../../models/user-anime.interface';
import { IUser } from '../../models/user.interface';
import { Button } from '../../components/button/button';
import { GenreScoreMap } from '../../models/anime-list.interface';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';

type ProfileTab = 'watchlist' | 'seen' | 'tierlist';
type TierRank = keyof ITierList;

@Component({
  selector: 'app-profil',
  imports: [Header, AnimeCard, Button, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './profil.html',
  styleUrl: './profil.scss',
})
export class ProfilPage {
  /**
   * Page Profil — affiche les listes utilisateur (watchlist, seen, tierlist).
   *
   * Utilise `StorageService` pour récupérer l'utilisateur courant et
   * `TenraiService` pour récupérer les données des animés par ID.
   */
  public currentUser: IUser | null;
  public selectedTab: WritableSignal<ProfileTab> = signal('watchlist');
  public watchlist: WritableSignal<HomeAnime[]> = signal([]);
  public seen: WritableSignal<HomeAnime[]> = signal([]);
  public tierRows = signal<Record<TierRank, HomeAnime[]>>({
    S: [],
    A: [],
    B: [],
    C: [],
  });
  public pinnedImages = signal<HomeAnime[]>([]);
  public hoveredTier = signal<TierRank | null>(null);
  public isPinDropHover = signal(false);
  public isLoading = signal(true);

  readonly tierOrder: TierRank[] = ['S', 'A', 'B', 'C'];

  private readonly tierWeights: Record<TierRank, number> = {
    S: 5,
    A: 3,
    B: 1,
    C: -1,
  };

  constructor(
    private storageService: StorageService,
    private tenrai: TenraiService,
  ) {
    this.currentUser = this.storageService.getCurrentUser();
    this.loadLists();
  }

  selectTab(tab: ProfileTab) {
    this.selectedTab.set(tab);
  }

  trackByAnimeId(index: number, anime: HomeAnime) {
    return anime.mal_id;
  }

  getCoverUrl(anime: HomeAnime): string {
    return this.tenrai.getCoverUrl(anime);
  }

  getDisplayTitle(anime: HomeAnime): string {
    return this.tenrai.getDisplayTitle(anime);
  }

  onTierEnter(tier: TierRank): void {
    this.hoveredTier.set(tier);
  }

  onTierLeave(tier: TierRank): void {
    if (this.hoveredTier() === tier) {
      this.hoveredTier.set(null);
    }
  }

  onTierDropped(event: CdkDragDrop<HomeAnime[]>, tier: TierRank): void {
    const anime = event.item.data as HomeAnime | undefined;
    this.hoveredTier.set(null);

    if (!anime?.mal_id) return;

    const update = this.storageService.updateAnimeTier(anime.mal_id, tier);
    if (!update) return;

    const delta = this.getTierWeight(update.nextTier) - this.getTierWeight(update.previousTier);
    if (delta !== 0) {
      this.applyGenreDeltaFromAnime(anime, delta);
    }

    this.currentUser = this.storageService.getCurrentUser();
    this.refreshTierRows();
  }

  onPinDropped(event: CdkDragDrop<HomeAnime[]>): void {
    const anime = event.item.data as HomeAnime | undefined;
    this.isPinDropHover.set(false);
    this.hoveredTier.set(null);

    if (!anime?.mal_id) return;

    const update = this.storageService.updateAnimeTier(anime.mal_id, null);
    if (!update) return;

    const delta = this.getTierWeight(update.nextTier) - this.getTierWeight(update.previousTier);
    if (delta !== 0) {
      this.applyGenreDeltaFromAnime(anime, delta);
    }

    this.currentUser = this.storageService.getCurrentUser();
    this.refreshTierRows();
  }

  onPinEnter(): void {
    this.isPinDropHover.set(true);
    this.hoveredTier.set(null);
  }

  onPinExit(): void {
    this.isPinDropHover.set(false);
  }

  private loadLists() {
    this.currentUser = this.storageService.getCurrentUser();

    if (!this.currentUser) {
      this.watchlist.set([]);
      this.seen.set([]);
      this.tierRows.set({ S: [], A: [], B: [], C: [] });
      this.pinnedImages.set([]);
      this.isLoading.set(false);
      return;
    }

    this.currentUser.tierList ??= { S: [], A: [], B: [], C: [] };

    const watchlistIds = this.currentUser.animeList
      .filter((entry) => entry.status === 'plan_to_watch')
      .map((entry) => entry.animeId);

    const seenIds = this.currentUser.animeList
      .filter((entry) => entry.status === 'seen')
      .map((entry) => entry.animeId);
    const tierIds = [
      ...(this.currentUser.tierList.S ?? []),
      ...(this.currentUser.tierList.A ?? []),
      ...(this.currentUser.tierList.B ?? []),
      ...(this.currentUser.tierList.C ?? []),
    ];
    const uniqueIds = [...new Set([...watchlistIds, ...seenIds, ...tierIds])];

    this.isLoading.set(true);

    this.tenrai.getByIds(uniqueIds, false, 2).subscribe({
      next: (animes) => {
        const animeById = new Map(animes.map((anime) => [anime.mal_id, anime]));

        const watchlist = watchlistIds
          .map((animeId) => animeById.get(animeId))
          .filter((anime): anime is HomeAnime => !!anime)
          .map((anime) => ({
            ...anime,
            userStatus: 'plan_to_watch' as const,
          }));

        const seen = seenIds
          .map((animeId) => animeById.get(animeId))
          .filter((anime): anime is HomeAnime => !!anime)
          .map((anime) => ({
            ...anime,
            userStatus: 'seen' as const,
          }));

        this.watchlist.set(watchlist);
        this.seen.set(seen);
        this.refreshTierRows();
        this.isLoading.set(false);
      },
      error: () => {
        this.watchlist.set([]);
        this.seen.set([]);
        this.tierRows.set({ S: [], A: [], B: [], C: [] });
        this.pinnedImages.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private refreshTierRows(): void {
    const user = this.currentUser;
    if (!user) {
      this.tierRows.set({ S: [], A: [], B: [], C: [] });
      this.pinnedImages.set([]);
      return;
    }

    user.tierList ??= { S: [], A: [], B: [], C: [] };

    const seenById = new Map(this.seen().map((anime) => [anime.mal_id, anime]));

    const buildTier = (tier: TierRank): HomeAnime[] =>
      (user.tierList[tier] ?? [])
        .map((id) => seenById.get(id))
        .filter((anime): anime is HomeAnime => !!anime);

    const rows: Record<TierRank, HomeAnime[]> = {
      S: buildTier('S'),
      A: buildTier('A'),
      B: buildTier('B'),
      C: buildTier('C'),
    };

    this.tierRows.set(rows);

    const rankedIds = new Set<number>([
      ...rows.S.map((anime) => anime.mal_id),
      ...rows.A.map((anime) => anime.mal_id),
      ...rows.B.map((anime) => anime.mal_id),
      ...rows.C.map((anime) => anime.mal_id),
    ]);

    this.pinnedImages.set(this.seen().filter((anime) => !rankedIds.has(anime.mal_id)));
  }

  private getTierWeight(tier: TierRank | null): number {
    if (!tier) return 0;
    return this.tierWeights[tier] ?? 0;
  }

  private applyGenreDeltaFromAnime(anime: HomeAnime, delta: number): void {
    if (!delta) return;

    const genreDeltas: GenreScoreMap = {};

    (anime.genres ?? []).forEach((genre) => {
      const genreId = genre.mal_id ?? (genre as unknown as { id?: number }).id;
      if (!genreId || genreId <= 0) return;

      genreDeltas[genreId] = (genreDeltas[genreId] ?? 0) + delta;
    });

    if (Object.keys(genreDeltas).length > 0) {
      this.storageService.applyGenreDeltas(genreDeltas);
    }
  }
}
