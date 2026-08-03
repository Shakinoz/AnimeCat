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
  /** Visual style variant. */
  public readonly variant = input<ButtonVariant>('primary');

  /** Button size variant. */
  public readonly size = input<ButtonSize>('md');

  /** Native HTML button type. */
  public readonly type = input<ButtonType>('button');

  /** Optional text label. */
  public readonly label = input<string>();

  /** Optional icon displayed before the label. */
  public readonly icon = input<string>();

  /** Disables interactions when true. */
  public readonly disabled = input<boolean>(false);

  /** Special circular variant used by swipe actions. */
  public readonly swipe = input<boolean>(false);
}
