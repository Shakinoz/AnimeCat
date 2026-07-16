import { Component, signal, WritableSignal, ViewChild, ElementRef } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { JikanService } from '../../services/jikan.service';
import { SlicePipe } from '@angular/common';
import { Header } from '../../components/header/header';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { TRENDING_DATA as trendingData } from '../../data/trending-data';
import { Button } from '../../components/button/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StorageService } from '../../services/storage.service';
import { RouterLink } from "@angular/router";
import { AnimeStatus, HomeAnime } from '../../models/user-anime.interface';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-home',
  imports: [SlicePipe, Header, Button, MatProgressSpinnerModule, RouterLink, AnimeCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  @ViewChild('trendingCarousel', { read: ElementRef })
  trendingCarousel!: ElementRef<HTMLDivElement>;
  @ViewChild('popularCarousel', { read: ElementRef }) popularCarousel!: ElementRef<HTMLDivElement>;

  trending: WritableSignal<HomeAnime[]> = signal([]);
  popular: WritableSignal<HomeAnime[]> = signal([]);
  isLoading = signal(true);

  heroAnime?: HomeAnime;
  heroIndex = 0;

  get heroDots() {
    return Array.from({ length: this.trending().length }, (_, index) => index);
  }

  constructor(private jikan: JikanService, private storageService: StorageService, private notificationService: NotificationService) {
    this.loadData();
  }

  loadData() {
    this.jikan.getTopAiring(1, 12).subscribe({
      next: (res) => {
        this.trending.set(this.addUserStatus(res.data));
        this.heroAnime = this.trending()[0];
      },
      error: () => {
        this.trending.set(
          this.addUserStatus(trendingData.data as unknown as Anime[])
        );
        this.heroAnime = this.trending()[0];
      },
    });

    this.jikan.getMostPopular(1, 12).subscribe({
      next: (res) => {
        this.popular.set(this.addUserStatus(res.data));
        this.isLoading.set(false);
      },
      error: () => {
        this.popular.set(
          this.addUserStatus(popularData.data as unknown as Anime[])
        );
        this.isLoading.set(false);
      },
    });
  }

  nextHero() {
    this.heroIndex = (this.heroIndex + 1) % this.trending().length;
    this.heroAnime = this.trending()[this.heroIndex];
  }

  prevHero() {
    this.heroIndex = (this.heroIndex - 1 + this.trending().length) % this.trending().length;
    this.heroAnime = this.trending()[this.heroIndex];
  }

  setHeroIndex(index: number) {
    this.heroIndex = index;
    this.heroAnime = this.trending()[index];
  }

  scrollCarousel(section: 'trending' | 'popular', direction: 'left' | 'right') {
    const carousel =
      section === 'trending'
        ? this.trendingCarousel?.nativeElement
        : this.popularCarousel?.nativeElement;
    if (!carousel) {
      return;
    }

    const distance =
      direction === 'left' ? -carousel.offsetWidth * 0.75 : carousel.offsetWidth * 0.75;
    carousel.scrollBy({ left: distance, behavior: 'smooth' });
  }

  cover(anime: Anime) {
    return this.jikan.getCoverUrl(anime);
  }

  title(anime: Anime) {
    return this.jikan.getDisplayTitle(anime);
  }

  genres(anime: Anime) {
    return this.jikan.getGenresLabel(anime);
  }

  toggleStatus(animeId: number, status: AnimeStatus): void {
    if(!this.storageService.isAuthenticated()){
      this.notificationService.show('Vous devez être connecté pour ajouter un anime à votre liste.', true);
      return;
    }
    const currentStatus = this.storageService.getAnimeStatus(animeId);
    if (currentStatus === status) {
      this.storageService.removeAnime(animeId);
      this.updateLocalAnimeStatus(animeId, null);
    } else {
      this.storageService.updateAnimeStatus(animeId, status);
      this.updateLocalAnimeStatus(animeId, status);
    }
  }

  /*
   * Update the local state of the anime lists to reflect the user's status change.
  */
  private updateLocalAnimeStatus(animeId: number, status: HomeAnime['userStatus'] | null) {
    // Update hero if it matches
    if (this.heroAnime && this.heroAnime.mal_id === animeId) {
      this.heroAnime = { ...this.heroAnime, userStatus: status };
    }

    // Update trending list
    this.trending.update((list) => list.map(a => a.mal_id === animeId ? { ...a, userStatus: status } : a));

    // Update popular list
    this.popular.update((list) => list.map(a => a.mal_id === animeId ? { ...a, userStatus: status } : a));
  }

  private addUserStatus(animes: Anime[]): HomeAnime[] {
    return animes.map(anime => ({
      ...anime,
      userStatus: this.storageService.getAnimeStatus(anime.mal_id) ?? null
    }));
  }
}
