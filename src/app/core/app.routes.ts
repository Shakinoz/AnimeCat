import { ProfilPage } from '../pages/profil/profil';
import { Routes } from '@angular/router';
import { HomePage } from '../pages/home/home';
import { LoginPage } from '../pages/login/login';
import { SignPage } from '../pages/sign/sign';
import { DetailPage } from '../pages/detail/detail';
import { userNotLoggedGuard } from './guards/user-not-logged-guard';
import { CataloguePage } from '../pages/catalogue/catalogue';
import { SwipePage } from '../pages/swipe/swipe';

/** Central route table for all standalone pages in AnimeCat. */
export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'sign', component: SignPage },
  { path: 'login', component: LoginPage },
  { path: 'catalog', component: CataloguePage },
  { path: 'swipe', component: SwipePage, canActivate: [userNotLoggedGuard] },
  { path: 'detail/:id', component: DetailPage },
  { path: 'profil', component: ProfilPage, canActivate: [userNotLoggedGuard] },
  { path: '**', redirectTo: '' },
];
