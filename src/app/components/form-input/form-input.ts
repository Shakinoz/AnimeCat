import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  imports: [ReactiveFormsModule],
  templateUrl: './form-input.html',
  styleUrl: './form-input.scss',
})
export class FormInput {
  /** Visible label associated with the input. */
  public readonly label = input.required<string>();

  /** HTML id used to bind label and input. */
  public readonly id = input.required<string>();

  /** Native input type (text, email, password, etc.). */
  public readonly type = input.required<string>();

  /** Reactive form control backing this field. */
  public readonly control = input.required<FormControl>();
}
