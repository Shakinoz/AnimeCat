// ─────────────────────────────────────────────────────────────
// search-autocomplete.component.ts
// Recherche live avec mat-autocomplete — image + titre + synopsis
// PAS de navigation vers une page catalogue : uniquement la liste
// déroulante sous la barre, fidèle à Search_list.png
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

  // ── État ────────────────────────────────────────────────
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
   * Selection d'un résultat dans l'autocomplete : navigation vers la page détail.
   * Le champ d'input est vidé après la sélection pour garder l'UX propre.
   */

  // ── Sélection d'un résultat → fiche détail ───────────────
  onSelect(event: MatAutocompleteSelectedEvent): void {
    const anime = event.option.value as Anime;
    this.router.navigate(['/detail?id=', anime.mal_id]);
    this.results.set([]);
    this.hasSearched.set(false);
  }

  // ── Vide le champ ─────────────────────────────────────────
  clear(): void {
    this.searchControl.setValue('');
    this.results.set([]);
    this.hasSearched.set(false);
  }

  // ── displayWith : on vide toujours l'input après sélection ─
  displayFn = (): string => '';

  // ── Helpers template ──────────────────────────────────────
  cover(anime: Anime): string {
    return this.tenrai.getCoverUrl(anime);
  }
  title(anime: Anime): string {
    return this.tenrai.getDisplayTitle(anime);
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).src = 'assets/img/placeholder.webp';
  }

  trackById(_: number, anime: Anime): number {
    return anime.mal_id;
  }
}
