// ─────────────────────────────────────────────────────────────
// search-autocomplete.component.ts
// Live search powered by Angular Material autocomplete
// (poster + title + synopsis preview).
// ─────────────────────────────────────────────────────────────
import { Component, inject, signal, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  filter,
  tap,
  catchError,
} from 'rxjs/operators';
import { TenraiService } from '../../services/tenrai.service';
import { Anime } from '@tutkli/jikan-ts';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 6;

@Component({
  selector: 'app-searchbar',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './searchbar.html',
  styleUrl: './searchbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Searchbar {
  private tenrai = inject(TenraiService);
  private router = inject(Router);
  public readonly format = input<string>('desktop');

  // ── Reactive state ────────────────────────────────────────────────
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly results = signal<Anime[]>([]);
  readonly isLoading = signal(false);
  readonly hasSearched = signal(false);

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        filter((v): v is string => typeof v === 'string'),
        tap((value) => {
          const q = value.trim();
          if (q.length < MIN_CHARS) {
            this.results.set([]);
            this.hasSearched.set(false);
            this.isLoading.set(false);
          } else {
            this.isLoading.set(true);
            this.hasSearched.set(true);
          }
        }),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        filter((value) => value.trim().length >= MIN_CHARS),
        switchMap((value) =>
          this.tenrai
            .searchByName(value.trim(), 1, MAX_RESULTS)
            .pipe(catchError(() => of({ data: [], hasNextPage: false, currentPage: 1, total: 0 }))),
        ),
      )
      .subscribe((res) => {
        this.results.set(res.data);
        this.isLoading.set(false);
      });
  }

  /**
   * Handles autocomplete selection and navigates to detail page.
   * Input is cleared after selection for cleaner UX.
   */

  // ── Selection -> detail page ───────────────
  onSelect(event: MatAutocompleteSelectedEvent): void {
    const anime = event.option.value as Anime;
    this.router.navigate(['/detail', anime.mal_id]);
    this.results.set([]);
    this.hasSearched.set(false);
  }

  // ── Clear input and local results ─────────────────────────────────────────
  clear(): void {
    this.searchControl.setValue('');
    this.results.set([]);
    this.hasSearched.set(false);
  }

  // ── displayWith: keep input visually empty after selection ─
  displayFn = (): string => '';

  // ── Template helpers ──────────────────────────────────────
  /** Returns cover URL for an autocomplete item. */
  cover(anime: Anime): string {
    return this.tenrai.getCoverUrl(anime);
  }
  /** Returns display title for an autocomplete item. */
  title(anime: Anime): string {
    return this.tenrai.getDisplayTitle(anime);
  }

  /** Replaces broken image URLs with a local placeholder. */
  onImgError(e: Event): void {
    (e.target as HTMLImageElement).src = 'assets/img/placeholder.webp';
  }

  /** TrackBy function for stable option rendering. */
  trackById(_: number, anime: Anime): number {
    return anime.mal_id;
  }
}
