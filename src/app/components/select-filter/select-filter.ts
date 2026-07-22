import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() label?: string;
  @Input() id?: string;
  @Input() options: SelectOption[] = [];
  @Input() value?: string;
  @Output() valueChange = new EventEmitter<string>();

  onChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.valueChange.emit(v);
  }
}
