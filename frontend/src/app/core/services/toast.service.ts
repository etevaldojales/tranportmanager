import { Injectable } from '@angular/core';
import Toastify from 'toastify-js';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private lastToastText: string = '';
  private lastToastTime: number = 0;

  success(message: string, duration: number = 4000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration: number = 4500): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration: number = 4000): void {
    this.show(message, 'info', duration);
  }

  private show(message: string, type: 'success' | 'error' | 'warning' | 'info', duration: number): void {
    if (typeof window === 'undefined') return;

    const now = Date.now();
    // Previne emissões repetidas da mesma mensagem em janela curta (2s)
    if (this.lastToastText === message && (now - this.lastToastTime) < 2000) {
      return;
    }
    this.lastToastText = message;
    this.lastToastTime = now;

    let background = 'linear-gradient(to right, #10b981, #059669)'; // success
    let icon = '✔';

    if (type === 'error') {
      background = 'linear-gradient(to right, #ef4444, #dc2626)';
      icon = '✖';
    } else if (type === 'warning') {
      background = 'linear-gradient(to right, #f59e0b, #d97706)';
      icon = '⚠';
    } else if (type === 'info') {
      background = 'linear-gradient(to right, #3b82f6, #2563eb)';
      icon = 'ℹ';
    }

    Toastify({
      text: `${icon}  ${message}`,
      duration: duration,
      close: true,
      gravity: 'top',
      position: 'right',
      stopOnFocus: true,
      style: {
        background: background,
        borderRadius: '8px',
        fontWeight: '500',
        fontSize: '0.95rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        padding: '12px 20px',
        maxWidth: '400px'
      }
    }).showToast();
  }
}
