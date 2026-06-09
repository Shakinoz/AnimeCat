import { Component } from '@angular/core';
import { Searchbar } from '../searchbar/searchbar';
import { RouterLink } from '@angular/router';
import { Button } from '../button/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-header',
  imports: [Searchbar, RouterLink, Button, MatIconModule, MatButtonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  public showMenu: boolean = false;
}
