import { Component } from '@angular/core';
import { Searchbar } from '../searchbar/searchbar';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [Searchbar, RouterLink, RouterOutlet],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {}
