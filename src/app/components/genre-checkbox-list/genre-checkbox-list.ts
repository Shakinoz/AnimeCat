import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  /**
   * Liste de genres sous forme de cases à cocher.
   * Émet `selectedChange` lorsque la sélection change.
   */
  @Input() genres: GenreOption[] = [];
  @Input() selected: number[] = [];
  @Output() selectedChange = new EventEmitter<number[]>();

  toggle(id: number): void {
    const already = this.selected.includes(id);
    this.selected = already ? this.selected.filter((x) => x !== id) : [...this.selected, id];
    this.selectedChange.emit(this.selected);
  }
}
