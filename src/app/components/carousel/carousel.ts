import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-carousel',
  standalone: true,
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class Carousel {
  /** List of projected items rendered inside the carousel viewport. */
  public items = input<unknown[] | null | undefined>([]);
  /** Base scroll delta (in pixels) used by arrow navigation. */
  public scrollAmount = input<number>(320);

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('carouselViewport');

  private readonly state = signal({ canScrollLeft: false, canScrollRight: false });
  protected readonly canScrollLeft = computed(() => this.state().canScrollLeft);
  protected readonly canScrollRight = computed(() => this.state().canScrollRight);

  /** Computes initial arrow state after first render. */
  ngAfterViewInit(): void {
    this.updateState();
  }

  /** Recomputes arrow state when content size changes after checks. */
  ngAfterViewChecked(): void {
    this.updateState();
  }

  /** Scrolls the viewport in the requested direction with smooth behavior. */
  protected scroll(direction: 'left' | 'right'): void {
    const viewport = this.viewport().nativeElement;
    const amount = Math.max(viewport.clientWidth * 0.8, this.scrollAmount());
    viewport.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    this.updateState();
  }

  /** Updates enabled/disabled state for previous/next buttons. */
  protected updateState(): void {
    const viewport = this.viewport().nativeElement;
    const hasOverflow = viewport.scrollWidth > viewport.clientWidth + 1;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const atStart = viewport.scrollLeft <= 1;
    const atEnd = viewport.scrollLeft >= maxScrollLeft - 1;

    this.state.set({
      canScrollLeft: hasOverflow && !atStart,
      canScrollRight: hasOverflow && !atEnd,
    });
  }
}
