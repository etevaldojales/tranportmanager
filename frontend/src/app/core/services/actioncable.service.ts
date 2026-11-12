import { Injectable, NgZone } from '@angular/core';
import { createConsumer, Consumer, Channel } from '@rails/actioncable';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ActionCableService {
  private consumer: Consumer | null = null;
  private wsUrl = 'ws://localhost:8080/cable';

  constructor(private ngZone: NgZone) {
    this.consumer = createConsumer(this.wsUrl);
  }

  // Monitora novas corridas para os motoristas logados
  subscribeToDriverRides(): Observable<any> {
    const subject = new Subject<any>();

    if (!this.consumer) {
      this.consumer = createConsumer(this.wsUrl);
    }

    const channel = this.consumer.subscriptions.create('DriverRidesChannel', {
      connected: () => {
        console.log('[ActionCable] Conectado ao DriverRidesChannel');
      },
      disconnected: () => {
        console.warn('[ActionCable] Desconectado do DriverRidesChannel');
      },
      received: (data: any) => {
        this.ngZone.run(() => {
          subject.next(data);
        });
      }
    });

    return subject.asObservable();
  }

  // Monitora mudanças de status da corrida para o cliente
  subscribeToClientRide(rideId: number): Observable<any> {
    const subject = new Subject<any>();

    if (!this.consumer) {
      this.consumer = createConsumer(this.wsUrl);
    }

    const channel = this.consumer.subscriptions.create(
      { channel: 'ClientRideChannel', ride_id: rideId },
      {
        connected: () => {
          console.log(`[ActionCable] Conectado ao ClientRideChannel da corrida #${rideId}`);
        },
        disconnected: () => {
          console.warn(`[ActionCable] Desconectado do ClientRideChannel #${rideId}`);
        },
        received: (data: any) => {
          this.ngZone.run(() => {
            subject.next(data);
          });
        }
      }
    );

    return subject.asObservable();
  }
}

