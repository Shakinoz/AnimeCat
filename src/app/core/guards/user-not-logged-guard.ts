import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';

/**
 * Route guard that only allows authenticated users.
 * Redirects guests to home and shows an access notification.
 */
export const userNotLoggedGuard: CanActivateFn = (route, state) => {
  const storage = inject(StorageService);
  const router = inject(Router);
  const notify = inject(NotificationService);

  if (storage.isAuthenticated()) {
    return true;
  } else {
    notify.show('Vous devez vous connecter pour acceder a cette page', true);
    return router.createUrlTree(['/']);
  }
};
