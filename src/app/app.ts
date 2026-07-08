import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationToast } from './components/notification-toast/notification-toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationToast],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('AnimeCat_TFE');
}
