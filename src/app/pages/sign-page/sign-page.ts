import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormInput } from '../../components/form-input/form-input';
import { Router, RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { StorageService } from '../../services/storage.service';
import { Button } from '../../components/button/button';

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
  });
  public message = '';
  public isError = false;

  constructor(
    private readonly storageService: StorageService,
    private readonly router: Router,
  ) {}

  public handleSign() {
    if (this.signupForm.invalid) {
      return;
    }

    const result = this.storageService.register({
      username: this.signupForm.value.username ?? '',
      email: this.signupForm.value.email ?? '',
      password: this.signupForm.value.password ?? '',
    });

    this.message = result.message;
    this.isError = !result.success;

    if (result.success) {
      this.router.navigate(['/']);
    }
  }
}
