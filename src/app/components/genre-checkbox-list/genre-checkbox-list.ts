import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GenreOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-genre-checkbox-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './genre-checkbox-list.html',
  styleUrl: './genre-checkbox-list.scss',
})
export class GenreCheckboxList {
  /** Liste des genres affichés dans la colonne de filtres. */
  readonly genres = input<GenreOption[]>([]);

  /** Identifiants des genres actuellement sélectionnés. */
  readonly selected = input<number[]>([]);

  /** Émet la nouvelle sélection dès qu’un changement intervient. */
  readonly selectedChange = output<number[]>();

  toggle(id: number): void {
    const current = this.selected();
    const alreadySelected = current.includes(id);
    const nextSelection = alreadySelected
      ? current.filter((value) => value !== id)
      : [...current, id];
    this.selectedChange.emit(nextSelection);
  }
}
