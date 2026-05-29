import { Component, signal, WritableSignal } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { JikanService } from '../../services/jikan.service';
import { SlicePipe } from '@angular/common';
import { Header } from '../../components/header/header';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { TRENDING_DATA as trendingData } from '../../data/trending-data';

@Component({
  selector: 'app-home',
  imports: [SlicePipe, Header],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  trending: WritableSignal<Anime[]> = signal([]);
  popular: WritableSignal<Anime[]> = signal([]);
  isLoading = signal(true);

  heroAnime?: Anime;
  heroIndex = 0;

  constructor(private jikan: JikanService) {
    this.loadData();
  }

  loadData() {
    this.jikan.getTopAiring(1, 12).subscribe({
      next: (res) => {
        this.trending.set(res.data);
        this.heroAnime = this.trending()[0];
      },
      error: () => {
        this.trending.set(trendingData.data as unknown as Anime[]);
        this.heroAnime = this.trending()[0];
      },
    });

    this.jikan.getMostPopular(1, 12).subscribe({
      next: (res) => {
        this.popular.set(res.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.popular.set(popularData.data as unknown as Anime[]);
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

  cover(anime: Anime) {
    return this.jikan.getCoverUrl(anime);
  }

  title(anime: Anime) {
    return this.jikan.getDisplayTitle(anime);
  }

  genres(anime: Anime) {
    return this.jikan.getGenresLabel(anime);
  }
}
