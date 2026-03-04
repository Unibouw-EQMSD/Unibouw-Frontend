import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Alert {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  title?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private alertsSubject = new BehaviorSubject<Alert[]>([]);
  public alerts$ = this.alertsSubject.asObservable();
  private alertCounter = 0;

  constructor() {}

  /**
   * Show a success alert
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 3000)
   * @param title - Optional title for the alert
   */
  success(message: string, duration: number = 3000, title?: string): void {
    this.showAlert('success', message, duration, title);
  }

  /**
   * Show an error alert
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 5000)
   * @param title - Optional title for the alert
   */
  error(message: string, duration: number = 5000, title?: string): void {
    this.showAlert('error', message, duration, title);
  }

  /**
   * Show a warning alert
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 4000)
   * @param title - Optional title for the alert
   */
  warning(message: string, duration: number = 4000, title?: string): void {
    this.showAlert('warning', message, duration, title);
  }

  /**
   * Show an info alert
   * @param message - The message to display
   * @param duration - Duration in milliseconds (default: 3000)
   * @param title - Optional title for the alert
   */
  info(message: string, duration: number = 3000, title?: string): void {
    this.showAlert('info', message, duration, title);
  }

  /**
   * Internal method to show alert
   */
  private showAlert(
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    duration: number = 3000,
    title?: string
  ): void {
    const id = `alert-${this.alertCounter++}`;
    const alert: Alert = {
      id,
      message,
      type,
      duration,
      title,
    };

    const currentAlerts = this.alertsSubject.value;
    this.alertsSubject.next([...currentAlerts, alert]);

    // Auto-remove alert after duration
    if (duration > 0) {
      setTimeout(() => this.removeAlert(id), duration);
    }
  }

  /**
   * Remove an alert by ID
   */
  removeAlert(id: string): void {
    const currentAlerts = this.alertsSubject.value;
    this.alertsSubject.next(currentAlerts.filter((a) => a.id !== id));
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.alertsSubject.next([]);
  }
}
