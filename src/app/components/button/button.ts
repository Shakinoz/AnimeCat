import { Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'full';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  imports: [MatIcon],
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class Button {
  /** Style visuel du bouton. */
  public readonly variant = input<ButtonVariant>('primary');

  /** Taille du bouton utilisée par les variantes de style. */
  public readonly size = input<ButtonSize>('md');

  /** Type HTML du bouton pour les formulaires. */
  public readonly type = input<ButtonType>('button');

  /** Libellé affiché dans le bouton. */
  public readonly label = input<string>();

  /** Icône optionnelle affichée avant le texte. */
  public readonly icon = input<string>();

  /** Désactive le bouton si nécessaire. */
  public readonly disabled = input<boolean>(false);

  /** Variante spéciale utilisée pour les boutons de swipe. */
  public readonly swipe = input<boolean>(false);
}
