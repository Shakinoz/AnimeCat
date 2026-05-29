import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { LoginPage } from './pages/login-page/login-page';
import { SignPage } from './pages/sign-page/sign-page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'sign', component: SignPage },
  { path: 'login', component: LoginPage },
  { path: '**', redirectTo: '' },
];
