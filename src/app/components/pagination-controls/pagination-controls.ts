import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination-controls.html',
  styleUrl: './pagination-controls.scss',
})
export class PaginationControls {
  /** Currently displayed page number. */
  readonly currentPage = input(1);

  /** Indicates whether a next page can be requested. */
  readonly hasNext = input(false);

  /** Emits when user requests previous page. */
  readonly prev = output<void>();

  /** Emits when user requests next page. */
  readonly next = output<void>();

  /** Emits `prev` when current page is greater than 1. */
  onPrev(): void {
    if (this.currentPage() > 1) this.prev.emit();
  }

  /** Emits `next` when there is a next page available. */
  onNext(): void {
    if (this.hasNext()) this.next.emit();
  }
}
