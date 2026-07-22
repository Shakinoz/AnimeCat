// ─────────────────────────────────────────────────────────────
// notification.service.ts
// Service global de notifications temporaires (toast).
// Utilisé par les pages et composants pour informer l'utilisateur
// d'une action réussie ou d'une erreur.
// ─────────────────────────────────────────────────────────────
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  /**
   * Service de toast simplifié basé sur des `signal()`.
   * Les composants lisent `message`, `visible`, `isError`, `isSuccess`
   * pour afficher un toast et appellent `show()` / `hide()` selon besoin.
   */
  // ── State Signals (réactifs, lus directement dans les templates) ──

  /** Texte du message affiché dans le toast. */
  readonly message = signal('');
  /** true si le toast doit s'afficher avec le style erreur (rouge). */
  readonly isError = signal(false);
  /** true si le toast doit s'afficher avec le style succès (vert). */
  readonly isSuccess = signal(false);
  /** Contrôle la visibilité du toast. */
  readonly visible = signal(false);

  /** Référence au timer de fermeture automatique. */
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Affiche un toast avec le message et le style spécifié.
   * Se ferme automatiquement après `duration` ms.
   *
   * @param message   Texte à afficher
   * @param isError   Affiche le style erreur (rouge) si true
   * @param isSuccess Affiche le style succès (vert) si true
   * @param duration  Durée d'affichage en ms (défaut : 3000)
   */
  show(message: string, isError = false, isSuccess = false, duration = 3000): void {
    // Annule un timer en cours si un nouveau toast est déclenché
    if (this.timer) clearTimeout(this.timer);

    this.message.set(message);
    this.isError.set(isError);
    this.isSuccess.set(isSuccess);
    this.visible.set(true);

    this.timer = setTimeout(() => this.hide(), duration);
  }

  /** Ferme immédiatement le toast et réinitialise l'état. */
  hide(): void {
    this.visible.set(false);
    this.message.set('');
    this.isError.set(false);
    this.isSuccess.set(false);
    this.timer = null;
  }
}
