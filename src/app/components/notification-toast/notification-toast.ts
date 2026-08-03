import { Component } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-toast',
  standalone: true,
  imports: [],
  templateUrl: './notification-toast.html',
  styleUrl: './notification-toast.scss',
})
export class NotificationToast {
  constructor(public readonly notificationService: NotificationService) {}

  /** Closes the currently visible toast notification. */
  public close(): void {
    this.notificationService.hide();
  }
}
