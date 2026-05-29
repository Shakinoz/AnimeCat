import { Component, OnInit } from '@angular/core';
import { Anime } from '@tutkli/jikan-ts';
import { JikanService } from '../../services/jikan.service';
import { SlicePipe } from '@angular/common';
import { Header } from '../../components/header/header';
import { ChangeDetectorRef } from '@angular/core';
// TODO : use signal instead change detector ref
import { TRENDING_DATA as trendingData } from '../../data/trending';


@Component({
  selector: 'app-home',
  imports: [SlicePipe, Header],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage{
  trending: Anime[] = [];
  popular: Anime[] = [];
  isLoading = true;

  heroAnime?: Anime;
  heroIndex = 0;

  constructor(private jikan: JikanService,  private cdr: ChangeDetectorRef ) {
    this.loadData();

  }

  loadData() {
    this.jikan.getTopAiring(1, 12).subscribe((res) => {
      this.trending = res.data;
      this.heroAnime = this.trending[0];
      this.cdr.markForCheck();
    });

    this.jikan.getMostPopular(1, 12).subscribe((res) => {
      this.popular = res.data;
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    this.fillPopularFromTrendingIfEmpty();
  }

  fillPopularFromTrendingIfEmpty() {
    setTimeout(() => {
      if (!this.popular?.length) {
        this.popular = [...(trendingData.data as unknown as Anime[])];
        this.cdr.markForCheck();
      }
    }, 5000);
  }

  nextHero() {
    this.heroIndex = (this.heroIndex + 1) % this.trending.length;
    this.heroAnime = this.trending[this.heroIndex];
  }

  prevHero() {
    this.heroIndex = (this.heroIndex - 1 + this.trending.length) % this.trending.length;
    this.heroAnime = this.trending[this.heroIndex];
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
