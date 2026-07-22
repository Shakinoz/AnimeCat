import { Component, signal, WritableSignal } from '@angular/core';
import { Header } from '../../components/header/header';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { StorageService } from './../../services/storage.service';
import { TenraiService } from '../../services/tenrai.service';
import { HomeAnime } from '../../models/user-anime.interface';
import { IUser } from '../../models/user.interface';
import { Button } from '../../components/button/button';

@Component({
  selector: 'app-profil',
  imports: [Header, AnimeCard, Button],
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
  public selectedTab: WritableSignal<'watchlist' | 'seen' | 'tierlist'> = signal('watchlist');
  public watchlist: WritableSignal<HomeAnime[]> = signal([]);
  public seen: WritableSignal<HomeAnime[]> = signal([]);
  public tierlist: WritableSignal<HomeAnime[]> = signal([]);
  public isLoading = signal(true);

  constructor(
    private storageService: StorageService,
    private tenrai: TenraiService,
  ) {
    this.currentUser = this.storageService.getCurrentUser();
    this.loadLists();
  }

  selectTab(tab: 'watchlist' | 'seen' | 'tierlist') {
    this.selectedTab.set(tab);
  }

  trackByAnimeId(index: number, anime: HomeAnime) {
    return anime.mal_id;
  }

  private loadLists() {
    if (!this.currentUser) {
      this.watchlist.set([]);
      this.seen.set([]);
      this.isLoading.set(false);
      return;
    }

    const watchlistIds = this.currentUser.animeList
      .filter((entry) => entry.status === 'plan_to_watch')
      .map((entry) => entry.animeId);

    const seenIds = this.currentUser.animeList
      .filter((entry) => entry.status === 'seen')
      .map((entry) => entry.animeId);
    const uniqueIds = [...new Set([...watchlistIds, ...seenIds])];

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
        this.tierlist.set(seen);
        this.isLoading.set(false);
      },
      error: () => {
        this.watchlist.set([]);
        this.seen.set([]);
        this.tierlist.set([]);
        this.isLoading.set(false);
      },
    });
  }
}
