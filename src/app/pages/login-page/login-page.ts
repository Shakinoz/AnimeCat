import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { Header } from '../../components/header/header';
import { FormInput } from '../../components/form-input/form-input';
import { Button } from '../../components/button/button';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Header, FormInput, Button, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  /**
   * Login page handling the local authentication form.
   *
   * Validates fields with `ReactiveFormsModule`, then delegates
   * authentication to `StorageService`.
   */
  public loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });
  constructor(
    private readonly storageService: StorageService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
  ) {}

  /** Executes login flow and redirects on success. */
  public handleLogin(): void {
    if (this.loginForm.invalid) {
      return;
    }

    const result = this.storageService.login({
      email: this.loginForm.value.email ?? '',
      password: this.loginForm.value.password ?? '',
    });

    this.notificationService.show(result.message, !result.success, result.success);

    if (result.success) {
      this.router.navigate(['/']);
    }
  }
}
