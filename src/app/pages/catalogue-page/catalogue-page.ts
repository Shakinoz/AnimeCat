import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenraiService } from '../../services/tenrai.service';
import { Anime } from '@tutkli/jikan-ts';
import { AnimeListResult } from '../../models/anime-list.interface';
import { Header } from '../../components/header/header';
import { AnimeCard } from '../../components/anime-card/anime-card';

@Component({
  selector: 'app-catalogue',
  standalone: true,
  imports: [CommonModule, Header, AnimeCard],
  templateUrl: './catalogue-page.html',
  styleUrl: './catalogue-page.scss',
})
export class CataloguePage {
  // Liste brute retournée par l'API avant toute transformation locale.
  animes: Anime[] = [];

  // Liste affichée après application du tri local et des filtres de présentation.
  filteredAnimes: Anime[] = [];

  // Indicateur de chargement utilisé par le template pour afficher un état de progression.
  isLoading = signal(false);

  // État des filtres de recherche et de navigation.
  searchQuery = '';
  selectedType: string = 'all';
  selectedStatus: string = 'all';
  selectedGenres: number[] = [];
  sortBy: 'score-desc' | 'score-asc' | 'alphabetic-asc' | 'alphabetic-desc' = 'score-desc';

  // Pagination pour gérer les pages successives de résultats.
  currentPage = 1;
  limit = 24;
  totalItems = 0;
  hasNextPage = false;

  // Options de filtre proposées à l'utilisateur dans la sidebar.
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

  // Liste des genres disponibles pour la sélection par cases à cocher.
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

  // Chargement initial de la page au démarrage du composant.
  constructor(private readonly tenraiService: TenraiService) {
    this.loadAnimes();
  }

  // Appel au service pour récupérer les animes selon les filtres actifs.
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
        // La réponse de l'API fournit la liste brute ainsi que les métadonnées de pagination.
        this.animes = result.data || [];
        this.totalItems = result.total || 0;
        this.hasNextPage = result.hasNextPage || false;

        // Après chaque réception, on applique le tri local et on met à jour la grille.
        this.applyLocalFilters();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des animes:', err);
        this.isLoading.set(false);
      },
    });
  }

  // Applique le tri local sur la liste déjà reçue depuis l'API.
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

  // Réinitialise la pagination à la première page après un changement de recherche.
  onSearchChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  // Met à jour la valeur de recherche à partir de l'événement natif du champ input.
  handleSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery = target?.value ?? '';
    this.onSearchChange();
  }

  // Recharge les résultats quand le type de diffusion change.
  onTypeChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  // Met à jour la valeur du type à partir de l'événement natif du select.
  handleTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedType = target?.value ?? 'all';
    this.onTypeChange();
  }

  // Recharge les résultats quand le statut change.
  onStatusChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  // Met à jour la valeur du statut à partir de l'événement natif du select.
  handleStatusChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedStatus = target?.value ?? 'all';
    this.onStatusChange();
  }

  // Recharge les résultats quand la liste de genres change.
  onGenreChange(): void {
    this.currentPage = 1;
    this.loadAnimes();
  }

  // Basculer un genre dans la sélection et relancer la recherche.
  toggleGenreSelection(genreId: number): void {
    const alreadySelected = this.selectedGenres.includes(genreId);

    this.selectedGenres = alreadySelected
      ? this.selectedGenres.filter((id) => id !== genreId)
      : [...this.selectedGenres, genreId];

    this.onGenreChange();
  }

  // Re-trie simplement la liste déjà chargée sans refaire un appel réseau.
  onSortChange(): void {
    this.applyLocalFilters();
  }

  // Met à jour la valeur du tri à partir de l'événement natif du select.
  handleSortChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value as typeof this.sortBy | undefined;
    this.sortBy = value ?? 'score-desc';
    this.onSortChange();
  }

  // Passe à la page suivante si elle existe.
  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadAnimes();
    }
  }

  // Revient à la page précédente si la page actuelle n'est pas la première.
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadAnimes();
    }
  }

  // Retourne l'URL de l'image de couverture de l'anime, avec un fallback propre.
  getImageUrl(anime: Anime): string {
    return (
      anime.images?.jpg?.large_image_url ||
      anime.images?.jpg?.image_url ||
      '/assets/placeholder.jpg'
    );
  }
}
