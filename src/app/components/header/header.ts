import { Component } from '@angular/core';
import { Searchbar } from '../searchbar/searchbar';
import { RouterLink } from '@angular/router';
import { Button } from '../button/button';

@Component({
  selector: 'app-header',
  imports: [Searchbar, RouterLink, Button],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {}
