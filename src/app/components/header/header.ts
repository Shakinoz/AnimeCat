import { Component } from '@angular/core';
import { Searchbar } from '../searchbar/searchbar';
import { RouterLink } from '@angular/router';
import { Button } from '../button/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-header',
  imports: [Searchbar, RouterLink, Button, MatIconModule, MatButtonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  public showMenu: boolean = false;

  constructor(
    public readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
  ) {}

  public handleLogout() {
    this.storageService.logout();
    this.notificationService.show('Vous êtes déconnecté.', false, true);
  }
}
