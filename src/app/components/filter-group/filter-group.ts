import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-filter-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-group.html',
  styleUrl: './filter-group.scss',
})
export class FilterGroup {
  /**
   * Wrapper simple pour grouper un label et un contrôle de filtre.
   * Utilisé pour conserver une structure HTML cohérente dans la sidebar.
   */
  @Input() label?: string;
}
