import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormInput } from '../../components/form-input/form-input';
import { Router, RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { StorageService } from '../../services/storage.service';
import { Button } from '../../components/button/button';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-sign-page',
  imports: [ReactiveFormsModule, RouterLink, Header, Button, FormInput],
  templateUrl: './sign-page.html',
  styleUrl: './sign-page.scss',
})
export class SignPage {
  public signupForm = new FormGroup({
    username: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });
  public message = '';
  public isError = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly router: Router,
    private readonly notificationService: NotificationService,
  ) {}

  public handleSign() {
    if (
      this.signupForm.invalid ||
      this.signupForm.value.confirmPassword !== this.signupForm.value.password
    ) {
      return;
    }

    const result = this.storageService.register({
      username: this.signupForm.value.username ?? '',
      email: this.signupForm.value.email ?? '',
      password: this.signupForm.value.password ?? '',
    });

    this.notificationService.show(result.message, !result.success, result.success);

    const loginResult = this.storageService.login({
      email: this.signupForm.value.email ?? '',
      password: this.signupForm.value.password ?? '',
    });

    if (!loginResult.success) {
      this.notificationService.show(loginResult.message, !loginResult.success, loginResult.success);
    }

    if (result.success) {
      this.router.navigate(['/']);
    }
  }
}
