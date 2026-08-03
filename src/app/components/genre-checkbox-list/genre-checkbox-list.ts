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
  /** Genre options shown in the filters column. */
  readonly genres = input<GenreOption[]>([]);

  /** IDs of currently selected genres. */
  readonly selected = input<number[]>([]);

  /** Emits updated selection whenever a checkbox changes. */
  readonly selectedChange = output<number[]>();

  /** Toggles one genre ID inside the selected collection. */
  toggle(id: number): void {
    const current = this.selected();
    const alreadySelected = current.includes(id);
    const nextSelection = alreadySelected
      ? current.filter((value) => value !== id)
      : [...current, id];
    this.selectedChange.emit(nextSelection);
  }
}
