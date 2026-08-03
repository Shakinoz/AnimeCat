import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-filter-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
})
export class FilterGroup {
  /**
   * Label displayed above a filter control.
   * This wrapper keeps filter blocks semantically and visually consistent.
   */
  readonly label = input<string>('');
}
