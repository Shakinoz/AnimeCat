// ─────────────────────────────────────────────────────────────
// notification.service.ts
// Global temporary notification service (toast).
// Used by pages and components to inform users about
// successful actions or errors.
// ─────────────────────────────────────────────────────────────
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /**
   * Lightweight toast service powered by Angular signals.
   * Components read `message`, `visible`, `isError`, and `isSuccess`
   * to render notifications and call `show()` / `hide()` as needed.
   */
  // ── State signals (reactive, consumed directly in templates) ──

  /** Notification message text displayed in the toast. */
  readonly message = signal('');
  /** True when the toast should use the error style. */
  readonly isError = signal(false);
  /** True when the toast should use the success style. */
  readonly isSuccess = signal(false);
  /** Controls toast visibility. */
  readonly visible = signal(false);

  /** Auto-close timer reference. */
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Displays a toast with the provided message and style.
   * Automatically closes after `duration` milliseconds.
   *
   * @param message Message to display.
   * @param isError Whether to use the error style.
   * @param isSuccess Whether to use the success style.
   * @param duration Display duration in milliseconds.
   */
  show(message: string, isError = false, isSuccess = false, duration = 3000): void {
    // Cancel any active timer before showing a new toast.
    if (this.timer) clearTimeout(this.timer);

    this.message.set(message);
    this.isError.set(isError);
    this.isSuccess.set(isSuccess);
    this.visible.set(true);

    this.timer = setTimeout(() => this.hide(), duration);
  }

  /** Immediately closes the toast and resets state values. */
  hide(): void {
    this.visible.set(false);
    this.message.set('');
    this.isError.set(false);
    this.isSuccess.set(false);
    this.timer = null;
  }
}
