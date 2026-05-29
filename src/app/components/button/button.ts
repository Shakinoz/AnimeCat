import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrl: './button.scss',
})
export class Button {
  public variant = input<ButtonVariant>('primary');
  public size = input<ButtonSize>('md');
  public type = input<ButtonType>('button');
  public label = input.required<string>();
}
