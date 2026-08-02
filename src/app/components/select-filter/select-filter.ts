import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select-filter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-filter.html',
  styleUrl: './select-filter.scss',
})
export class SelectFilter {
  /** Libellé visible au-dessus du sélecteur. */
  readonly label = input<string>('');

  /** Identifiant HTML du select pour le formulaire et l'accessibilité. */
  readonly id = input<string>('');

  /** Liste des options proposées à l’utilisateur. */
  readonly options = input<SelectOption[]>([]);

  /** Valeur actuellement sélectionnée. */
  readonly value = input<string>('');

  /** Émet la nouvelle valeur quand l’utilisateur change de choix. */
  readonly valueChange = output<string>();

  onChange(event: Event): void {
    const nextValue = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(nextValue);
  }
}
