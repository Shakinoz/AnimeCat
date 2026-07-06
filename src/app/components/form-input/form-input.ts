import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  imports: [ReactiveFormsModule],
  templateUrl: './form-input.html',
  styleUrl: './form-input.scss',
})
export class FormInput {
  public readonly label = input.required<string>();
  public readonly id = input.required<string>();
  public readonly type = input.required<string>();
  public readonly control = input.required<FormControl>();
}
