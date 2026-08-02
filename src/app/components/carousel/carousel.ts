import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-carousel',
  standalone: true,
  templateUrl: './carousel.html',
  styleUrl: './carousel.scss',
})
export class Carousel {
  public items = input<unknown[] | null | undefined>([]);
  public scrollAmount = input<number>(320);

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('carouselViewport');

  private readonly state = signal({ canScrollLeft: false, canScrollRight: false });
  protected readonly canScrollLeft = computed(() => this.state().canScrollLeft);
  protected readonly canScrollRight = computed(() => this.state().canScrollRight);

  ngAfterViewInit(): void {
    this.updateState();
  }

  ngAfterViewChecked(): void {
    this.updateState();
  }

  protected scroll(direction: 'left' | 'right'): void {
    const viewport = this.viewport().nativeElement;
    const amount = Math.max(viewport.clientWidth * 0.8, this.scrollAmount());
    viewport.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    this.updateState();
  }

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
