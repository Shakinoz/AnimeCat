import { Component } from '@angular/core';
import { Searchbar } from '../searchbar/searchbar';
import { Router, RouterLink } from '@angular/router';
import { Button } from '../button/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';

interface HeaderNavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-header',
  imports: [Searchbar, RouterLink, Button, MatIconModule, MatButtonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  /** Indicates whether the mobile menu is open. */
  public showMenu = false;

  /** Main links rendered in desktop and mobile navigation. */
  public readonly navigationItems: HeaderNavItem[] = [
    { label: 'Catalogue', icon: 'apps', route: '/catalog' },
    { label: 'Swipe', icon: 'swipe', route: '/swipe' },
    { label: 'Profil', icon: 'person', route: '/profil' },
  ];

  constructor(
    public readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
  ) {}

  /** Logs out the current user and displays a confirmation toast. */
  public handleLogout(): void {
    this.storageService.logout();
    this.notificationService.show('Vous êtes déconnecté.', false, true);
    this.router.navigate(['/']);
  }

  /** Returns whether auth-dependent actions should be visible. */
  public isAuthenticated(): boolean {
    return this.storageService.isAuthenticated();
  }
}
