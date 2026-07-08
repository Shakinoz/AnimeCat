import { Component, signal, WritableSignal, ViewChild, ElementRef } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { JikanService } from '../../services/jikan.service';
import { SlicePipe } from '@angular/common';
import { Header } from '../../components/header/header';
import { POPULAR_DATA as popularData } from '../../data/popular-data';
import { TRENDING_DATA as trendingData } from '../../data/trending-data';
import { Button } from '../../components/button/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-home',
  imports: [SlicePipe, Header, Button, MatProgressSpinnerModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  @ViewChild('trendingCarousel', { read: ElementRef })
  trendingCarousel!: ElementRef<HTMLDivElement>;
  @ViewChild('popularCarousel', { read: ElementRef }) popularCarousel!: ElementRef<HTMLDivElement>;

  trending: WritableSignal<Anime[]> = signal([]);
  popular: WritableSignal<Anime[]> = signal([]);
  isLoading = signal(true);

  heroAnime?: Anime;
  heroIndex = 0;

  get heroDots() {
    return Array.from({ length: this.trending().length }, (_, index) => index);
  }

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
}
