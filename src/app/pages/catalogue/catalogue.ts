import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenraiService } from '../../services/tenrai.service';
import { Anime } from '@tutkli/jikan-ts';
import { AnimeListResult } from '../../models/anime-list.interface';
import { Header } from '../../components/header/header';
import { AnimeCard } from '../../components/anime-card/anime-card';
import { FilterGroup } from '../../components/filter-group/filter-group';
import { GenreCheckboxList } from '../../components/genre-checkbox-list/genre-checkbox-list';
import { PaginationControls } from '../../components/pagination-controls/pagination-controls';
import { SelectFilter } from '../../components/select-filter/select-filter';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatIcon } from '@angular/material/icon';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [
    CommonModule,
    Header,
    AnimeCard,
    MatProgressSpinner,
    FilterGroup,
    GenreCheckboxList,
    PaginationControls,
    SelectFilter,
    MatIcon,
  ],
  templateUrl: './catalogue.html',
  styleUrl: './catalogue.scss',
})
export class CataloguePage {
  /**
   * Catalogue page handling search, filters, and paginated browsing.
   *
   * This component centralizes:
   * - search parameter construction,
   * - API data loading,
   * - local sorting and filter rendering,
   * - reactive state consumed by the template.
   */
  // Raw list returned by the API before local transformations.
  animes: Anime[] = [];

  // List shown after local sorting and presentation filtering.
  filteredAnimes: Anime[] = [];

  // Loading signal used by the template to display progress states.
  isLoading = signal(false);
  isMobileDevice = signal(false);
  showFilters = signal(false);

  // Current state of search and filtering controls.
  searchQuery = '';
  selectedType: string = 'all';
  selectedStatus: string = 'all';
  selectedGenres: number[] = [];
  sortBy: 'score-desc' | 'score-asc' | 'alphabetic-asc' | 'alphabetic-desc' = 'score-desc';

  // Pagination state for result browsing.
  currentPage = 1;
  limit = 24;
  totalItems = 0;
  hasNextPage = false;

  // Filter options displayed in the sidebar.
  typeOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'tv', label: 'TV' },
    { value: 'movie', label: 'Film' },
    { value: 'ova', label: 'OVA' },
    { value: 'special', label: 'Spécial' },
    { value: 'ona', label: 'ONA' },
    { value: 'music', label: 'Clip Musique' },
  ];

  statusOptions = [
    { value: 'all', label: 'Tous' },
    { value: 'airing', label: 'En diffusion' },
    { value: 'complete', label: 'Terminé' },
    { value: 'upcoming', label: 'À venir' },
  ];

  sortOptions = [
    { value: 'score-desc', label: 'Note (décroissant)' },
    { value: 'score-asc', label: 'Note (croissant)' },
    { value: 'alphabetic-asc', label: 'Alphabétique (A-Z)' },
    { value: 'alphabetic-desc', label: 'Alphabétique (Z-A)' },
  ];

  // Available genres displayed as checkbox options.
  genreOptions = [
    { id: 1, label: 'Action' },
    { id: 2, label: 'Aventure' },
    { id: 4, label: 'Comédie' },
    { id: 8, label: 'Drame' },
    { id: 10, label: 'Fantaisie' },
    { id: 14, label: 'Horreur' },
    { id: 7, label: 'Mahou Shoujo' },
    { id: 18, label: 'Mecha' },
    { id: 19, label: 'Musique' },
    { id: 20, label: 'Mystère' },
    { id: 16, label: 'Psychologique' },
    { id: 22, label: 'Romance' },
    { id: 23, label: 'École' },
    { id: 24, label: 'Science-Fiction' },
    { id: 27, label: 'Shounen' },
    { id: 36, label: 'Shoujo' },
    { id: 30, label: 'Slice of Life' },
    { id: 37, label: 'Espace' },
    { id: 39, label: 'Sports' },
    { id: 38, label: 'Surnaturel' },
    { id: 41, label: 'Thriller' },
    { id: 26, label: 'Josei' },
    { id: 5, label: 'Enfants' },
    { id: 17, label: 'Militaire' },
    { id: 31, label: 'Policier' },
    { id: 40, label: 'Super Pouvoir' },
    { id: 35, label: 'Tragédie' },
  ];

  // Initial page setup on component creation.
  constructor(
    private readonly tenraiService: TenraiService,
    private readonly deviceDetector: DeviceDetectorService,
  ) {
    // Device detection drives a small mobile/desktop UX adaptation.
    this.isMobileDevice.set(this.deviceDetector.isMobile());
    this.showFilters.set(!this.isMobileDevice());

    this.loadAnimes();
  }

  /**
   * Loads anime using active filters and updates local state.
   * Updates `animes`, `filteredAnimes`, `totalItems`, and pagination flags.
   */
  loadAnimes(): void {
    this.isLoading.set(true);
    this.filteredAnimes = [];

    const params = {
      query: this.searchQuery,
      page: this.currentPage,
      limit: this.limit,
      type:
        this.selectedType !== 'all'
          ? (this.selectedType as 'tv' | 'movie' | 'ova' | 'special' | 'ona' | 'music')
          : undefined,
      status:
        this.selectedStatus !== 'all'
          ? (this.selectedStatus as 'airing' | 'complete' | 'upcoming')
          : undefined,
      genres: this.selectedGenres.length > 0 ? this.selectedGenres : undefined,
    };

    this.tenraiService.searchAdvanced(params).subscribe({
      next: (result: AnimeListResult) => {
        // API response includes raw list and pagination metadata.
        this.animes = result.data || [];
        this.totalItems = result.total || 0;
        this.hasNextPage = result.hasNextPage || false;

        // Re-apply local sorting after each response.
        this.applyLocalFilters();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error while loading anime:', err);
        this.isLoading.set(false);
      },
    });
  }

  /** Applies local sorting to the already loaded anime list. */
  applyLocalFilters(): void {
    this.filteredAnimes = [...this.animes];

    switch (this.sortBy) {
      case 'score-desc':
        this.filteredAnimes.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case 'score-asc':
        this.filteredAnimes.sort((a, b) => (a.score || 0) - (b.score || 0));
        break;
      case 'alphabetic-asc':
        this.filteredAnimes.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }),
        );
        break;
      case 'alphabetic-desc':
        this.filteredAnimes.sort((a, b) =>
          (b.title || '').localeCompare(a.title || '', 'fr', { sensitivity: 'base' }),
        );
        break;
    }
  }

  /** Resets pagination after a search criteria change. */
  onSearchChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  /** Updates search text from native input event. */
  handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery = target?.value ?? '';
    this.onSearchChange();
  }

  /** Reloads results when anime type filter changes. */
  onTypeChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  /** Updates type value from native select event. */
  handleTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedType = target?.value ?? 'all';
    this.onTypeChange();
  }

  /** Reloads results when status filter changes. */
  onStatusChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  /** Updates status value from native select event. */
  handleStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedStatus = target?.value ?? 'all';
    this.onStatusChange();
  }

  /** Reloads results when selected genres change. */
  onGenreChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  /** Toggles a genre selection and triggers a reload. */
  toggleGenreSelection(genreId: number): void {
    const alreadySelected = this.selectedGenres.includes(genreId);

    this.selectedGenres = alreadySelected
      ? this.selectedGenres.filter((id) => id !== genreId)
      : [...this.selectedGenres, genreId];

    this.onGenreChange();
  }

  /** Re-applies sorting without making a new API request. */
  onSortChange(): void {
    this.applyLocalFilters();
  }

  /** Updates sort value from native select event. */
  handleSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value as typeof this.sortBy | undefined;
    this.sortBy = value ?? 'score-desc';
    this.onSortChange();
  }

  /** Handles sort changes emitted directly as string values. */
  handleSortValueChange(value: string): void {
    this.sortBy = (value as typeof this.sortBy) ?? 'score-desc';
    this.onSortChange();
  }

  /** Moves to the next page when available. */
  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadAnimes();
    }
  }

  /** Moves to the previous page when possible. */
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadAnimes();
    }
  }

  /** Returns cover URL with a service-level fallback strategy. */
  getImageUrl(anime: Anime): string {
    return this.tenraiService.getCoverUrl(anime);
  }
}
