import { Component, signal, WritableSignal } from '@angular/core';
import { forkJoin, map, of } from 'rxjs';
import { Header } from '../../components/header/header';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { StorageService } from './../../services/storage.service';
import { JikanService } from '../../services/jikan.service';
import { AnimeStatus, HomeAnime } from '../../models/user-anime.interface';
import { IUser } from '../../models/user.interface';
import { Button } from '../../components/button/button';

@Component({
  selector: 'app-profil',
  imports: [Header, AnimeCard, Button],
  templateUrl: './profil.html',
  styleUrl: './profil.scss',
})
export class ProfilPage {
  public currentUser: IUser | null;
  public selectedTab: WritableSignal<'watchlist' | 'seen' | 'tierlist'> = signal('watchlist');
  public watchlist: WritableSignal<HomeAnime[]> = signal([]);
  public seen: WritableSignal<HomeAnime[]> = signal([]);
  public tierlist: WritableSignal<HomeAnime[]> = signal([]);
  public isLoading = signal(true);

  constructor(
    private storageService: StorageService,
    private jikan: JikanService,
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

    this.isLoading.set(true);

    forkJoin({
      watchlist: this.fetchAnimeList(watchlistIds, 'plan_to_watch'),
      seen: this.fetchAnimeList(seenIds, 'seen'),
    }).subscribe({
      next: ({ watchlist, seen }) => {
        this.watchlist.set(watchlist);
        this.seen.set(seen);
        this.tierlist.set(seen);
        this.isLoading.set(false);
      },
      error: () => {
        this.watchlist.set([]);
        this.seen.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private fetchAnimeList(animeIds: number[], status: AnimeStatus) {
    if (!animeIds.length) {
      return of([] as HomeAnime[]);
    }

    return forkJoin(animeIds.map((animeId) => this.jikan.getById(animeId))).pipe(
      map((animes) =>
        animes.map((anime) => ({
          ...anime,
          userStatus: status,
        })),
      ),
    );
  }
}
