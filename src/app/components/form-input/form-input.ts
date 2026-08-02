import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-form-input',
  imports: [ReactiveFormsModule],
  templateUrl: './form-input.html',
  styleUrl: './form-input.scss',
})
export class FormInput {
  /** Libellé visible associé au champ. */
  public readonly label = input.required<string>();

  /** Identifiant HTML utilisé pour l’association label/input. */
  public readonly id = input.required<string>();

  /** Type du champ de saisie (text, email, password, etc.). */
  public readonly type = input.required<string>();

  /** Contrôle Reactif du formulaire. */
  public readonly control = input.required<FormControl>();
}
