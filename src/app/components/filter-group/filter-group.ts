import { Component, input } from '@angular/core';
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
   * Libellé affiché au-dessus du contrôle de filtre.
   * Le composant sert de wrapper sémantique pour maintenir une structure UI homogène.
   */
  readonly label = input<string>('');
}
