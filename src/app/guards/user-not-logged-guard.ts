import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StorageService } from '../services/storage.service';

export const userNotLoggedGuard: CanActivateFn = (route, state) => {
  const storage = inject(StorageService);
  const router = inject(Router);

  return storage.isAuthenticated() ? true : router.createUrlTree(['/']);
};
