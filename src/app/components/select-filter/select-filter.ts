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
  /** Visible label displayed above the select element. */
  readonly label = input<string>('');

  /** HTML id used for form binding and accessibility. */
  readonly id = input<string>('');

  /** Available options rendered in the dropdown. */
  readonly options = input<SelectOption[]>([]);

  /** Currently selected value. */
  readonly value = input<string>('');

  /** Emits next value whenever user selection changes. */
  readonly valueChange = output<string>();

  /** Handles native change event and emits selected value. */
  onChange(event: Event): void {
    const nextValue = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(nextValue);
  }
}
