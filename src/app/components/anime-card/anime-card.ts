import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeAnime } from '../../models/user-anime.interface';

@Component({
  selector: 'app-anime-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './anime-card.html',
  styleUrl: './anime-card.scss',
})
export class AnimeCard {
  public anime = input<HomeAnime>();
}
