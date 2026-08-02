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
  /** Indique si le menu mobile est ouvert. */
  public showMenu = false;

  /** Liens principaux affichés dans le header desktop et mobile. */
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

  /** Déconnecte l'utilisateur et affiche une notification. */
  public handleLogout(): void {
    this.storageService.logout();
    this.notificationService.show('Vous êtes déconnecté.', false, true);
    this.router.navigate(['/']);
  }

  /** Indique si l’utilisateur est connecté pour afficher les actions d’authentification. */
  public isAuthenticated(): boolean {
    return this.storageService.isAuthenticated();
  }
}
