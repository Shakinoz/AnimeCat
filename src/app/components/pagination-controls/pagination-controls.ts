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
  /** Page actuellement affichée. */
  readonly currentPage = input(1);

  /** Indique s’il existe une page suivante à charger. */
  readonly hasNext = input(false);

  /** Émet un événement lorsque l’utilisateur demande la page précédente. */
  readonly prev = output<void>();

  /** Émet un événement lorsque l’utilisateur demande la page suivante. */
  readonly next = output<void>();

  onPrev(): void {
    if (this.currentPage() > 1) this.prev.emit();
  }

  onNext(): void {
    if (this.hasNext()) this.next.emit();
  }
}
