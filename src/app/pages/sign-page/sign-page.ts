import { Component } from '@angular/core';
import { FormInput } from '../../components/form-input/form-input';

@Component({
  selector: 'app-sign-page',
  imports: [FormInput],
  templateUrl: './sign-page.html',
  styleUrl: './sign-page.scss',
})
export class SignPage {

  public handleSign() {
    console.log('Sign up button clicked');
  }

}
