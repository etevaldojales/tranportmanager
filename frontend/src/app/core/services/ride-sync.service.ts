import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Ride } from '../models/ride.model';

@Injectable({
  providedIn: 'root'
})
export class RideSyncService {
  private readonly STORAGE_KEY = 'tm_client_active_ride';
  private channel: BroadcastChannel | null = null;

  private activeClientRideSubject = new BehaviorSubject<Ride | null>(null);
  activeClientRide$: Observable<Ride | null> = this.activeClientRideSubject.asObservable();

  constructor() {
    this.initBroadcastChannel();
    this.loadFromStorage();
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('tm_ride_sync');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'ACTIVE_RIDE_CHANGED') {
            this.activeClientRideSubject.next(event.data.ride);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel não disponível:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === this.STORAGE_KEY) {
          try {
            const ride = event.newValue ? JSON.parse(event.newValue) : null;
            this.activeClientRideSubject.next(ride);
          } catch {
            this.activeClientRideSubject.next(null);
          }
        }
      });
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const ride = JSON.parse(stored);
        this.activeClientRideSubject.next(ride);
      }
    } catch {
      this.activeClientRideSubject.next(null);
    }
  }

  setActiveClientRide(ride: Ride | null): void {
    this.activeClientRideSubject.next(ride);
    if (typeof window !== 'undefined') {
      try {
        if (ride) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(ride));
        } else {
          localStorage.removeItem(this.STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Erro ao acessar localStorage:', e);
      }

      try {
        this.channel?.postMessage({
          type: 'ACTIVE_RIDE_CHANGED',
          ride
        });
      } catch (e) {
        console.warn('Erro ao enviar mensagem no BroadcastChannel:', e);
      }
    }
  }

  getActiveClientRide(): Ride | null {
    return this.activeClientRideSubject.value;
  }

  // Verifica se uma determinada corrida ainda está ativa/disponível no Painel do Cliente
  isRideAvailableInClient(rideId: number): boolean {
    const active = this.activeClientRideSubject.value;
    if (!active) return false;
    return active.id === rideId && (active.status === 'PENDING' || active.status === 'IN_PROGRESS');
  }
}

