import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  public readonly message = signal('');
  public readonly isError = signal(false);
  public readonly isSuccess = signal(false);
  public readonly visible = signal(false);

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  public show(message: string, isError = false, isSuccess = false, duration = 3000): void {
    this.message.set(message);
    this.isError.set(isError);
    this.isSuccess.set(isSuccess);
    this.visible.set(true);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => this.hide(), duration);
  }

  public hide(): void {
    this.visible.set(false);
    this.message.set('');
    this.isError.set(false);
  }
}
