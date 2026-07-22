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
  public variant = input<ButtonVariant>('primary');
  public size = input<ButtonSize>('md');
  public type = input<ButtonType>('button');
  public label = input<string>();
  public icon = input<string>();
}
