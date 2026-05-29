import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-input',
  imports: [],
  templateUrl: './form-input.html',
  styleUrl: './form-input.scss',
})
export class FormInput {
  public readonly label = input.required<string>();
  public readonly id = input.required<string>();
  public readonly type = input.required<string>();

}
