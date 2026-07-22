import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination-controls.html',
  styleUrl: './pagination-controls.scss',
})
export class PaginationControls {
  /**
   * Contrôles de pagination simples (Précédent / Suivant).
   * Émet `prev` / `next` selon l'état (`currentPage`, `hasNext`).
   */
  @Input() currentPage = 1;
  @Input() hasNext = false;
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  onPrev(): void {
    if (this.currentPage > 1) this.prev.emit();
  }

  onNext(): void {
    if (this.hasNext) this.next.emit();
  }
}
