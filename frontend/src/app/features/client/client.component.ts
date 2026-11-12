import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ActionCableService } from '../../core/services/actioncable.service';
import { RideSyncService } from '../../core/services/ride-sync.service';
import { ToastService } from '../../core/services/toast.service';
import { Ride, User } from '../../core/models/ride.model';

@Component({
  selector: 'app-client',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.scss']
})
export class ClientComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private cable = inject(ActionCableService);
  private syncService = inject(RideSyncService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  rideForm!: FormGroup;
  clients: User[] = [];
  currentRide: Ride | null = null;
  driverInfo: any = null;

  errorMessage = '';
  successMessage = '';
  loading = false;

  private rideSubscription?: Subscription;
  private syncSubscription?: Subscription;
  private lastNotifiedRideId: number | null = null;
  private lastNotifiedStatus: string | null = null;

  ngOnInit(): void {
    this.initForm();
    this.loadClients();
    this.restoreActiveRide();
    this.listenToSyncService();
  }

  ngOnDestroy(): void {
    this.rideSubscription?.unsubscribe();
    this.syncSubscription?.unsubscribe();
  }

  private listenToSyncService(): void {
    this.syncSubscription = this.syncService.activeClientRide$.subscribe((syncedRide) => {
      this.ngZone.run(() => {
        if (!syncedRide) {
          if (this.currentRide && this.currentRide.status === 'PENDING') {
            this.currentRide = null;
            this.driverInfo = null;
            this.cdr.detectChanges();
          }
          return;
        }

        if (this.currentRide && this.currentRide.id === syncedRide.id) {
          const oldStatus = this.currentRide.status;
          this.currentRide = { ...this.currentRide, ...syncedRide };
          if (syncedRide.driver) {
            this.driverInfo = syncedRide.driver;
          } else if (syncedRide.driver_id && !this.driverInfo) {
            this.fetchDriverInfo(syncedRide.driver_id);
          }

          if (oldStatus !== syncedRide.status) {
            this.handleStatusChange(syncedRide.status, syncedRide);
          }
          this.cdr.detectChanges();
        } else if (!this.currentRide && syncedRide.status !== 'CANCELLED') {
          this.currentRide = syncedRide;
          if (syncedRide.driver) this.driverInfo = syncedRide.driver;
          if (syncedRide.id) this.listenToRideUpdates(syncedRide.id);
          this.handleStatusChange(syncedRide.status, syncedRide);
          this.cdr.detectChanges();
        }
      });
    });
  }

  private restoreActiveRide(): void {
    const active = this.syncService.getActiveClientRide();
    if (active && (active.status === 'PENDING' || active.status === 'IN_PROGRESS')) {
      this.currentRide = active;
      if (active.driver) {
        this.driverInfo = active.driver;
      }
      this.updateStatusMessages(active.status);

      if (active.id) {
        this.listenToRideUpdates(active.id);
        // Sincroniza com o banco de dados em tempo real
        this.api.getRideById(active.id).subscribe({
          next: (freshRide) => {
            this.ngZone.run(() => {
              if (freshRide) {
                this.currentRide = { ...this.currentRide, ...freshRide };
                if (freshRide.driver) {
                  this.driverInfo = freshRide.driver;
                } else if (freshRide.driver_id && !this.driverInfo) {
                  this.fetchDriverInfo(freshRide.driver_id);
                }
                this.updateStatusMessages(freshRide.status);
                this.syncService.setActiveClientRide(this.currentRide);
                this.cdr.detectChanges();
              }
            });
          },
          error: () => {}
        });
      }
    }
  }

  private updateStatusMessages(status?: string): void {
    if (status === 'IN_PROGRESS') {
      this.successMessage = 'Corrida aceita! O motorista está a caminho.';
      this.errorMessage = '';
    } else if (status === 'COMPLETED') {
      this.successMessage = 'Corrida concluída com sucesso! Obrigado por viajar conosco.';
      this.errorMessage = '';
    } else if (status === 'PENDING' && this.currentRide) {
      this.successMessage = `Corrida #${this.currentRide.id} aguardando motorista...`;
      this.errorMessage = '';
    }
  }

  private fetchDriverInfo(driverId: string): void {
    this.api.getUserById(driverId).subscribe({
      next: (driver) => {
        this.ngZone.run(() => {
          this.driverInfo = driver;
          this.cdr.detectChanges();
        });
      },
      error: () => {}
    });
  }

  private initForm(): void {
    this.rideForm = this.fb.group({
      userId: ['user-client-1', [Validators.required]],
      originAddress: ['', [Validators.required, Validators.minLength(3)]],
      destinationAddress: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  loadClients(): void {
    this.api.getUsers('CLIENT').subscribe({
      next: (users) => {
        this.clients = users;
      },
      error: () => {
        this.clients = [
          { id: 'user-client-1', name: 'Carlos Silva (Cliente)', role: 'CLIENT', email: 'carlos@exemplo.com' },
          { id: 'user-client-2', name: 'Mariana Souza (Cliente)', role: 'CLIENT', email: 'mariana@exemplo.com' }
        ];
      }
    });
  }

  solicitarCorrida(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.rideForm.invalid) {
      this.errorMessage = 'Por favor, preencha todos os campos obrigatórios corretamente.';
      return;
    }

    const { userId, originAddress, destinationAddress } = this.rideForm.value;

    if (originAddress.trim().toLowerCase() === destinationAddress.trim().toLowerCase()) {
      this.errorMessage = 'O endereço de partida e destino não podem ser iguais.';
      return;
    }

    this.loading = true;

    this.api.createRide({
      user_id: userId,
      origin_address: originAddress,
      destination_address: destinationAddress
    }).subscribe({
      next: (ride) => {
        this.loading = false;
        this.currentRide = ride;
        this.driverInfo = null;
        this.syncService.setActiveClientRide(ride);
        this.successMessage = `Corrida #${ride.id} solicitada com sucesso! Aguardando aceite de um motorista...`;
        this.toast.success(`Corrida #${ride.id} solicitada com sucesso!`);
        this.listenToRideUpdates(ride.id!);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.error || err.error?.errors?.join(', ') || 'Erro ao solicitar corrida.';
        this.errorMessage = msg;
        this.toast.error(msg);
        this.cdr.detectChanges();
      }
    });
  }

  private listenToRideUpdates(rideId: number): void {
    this.rideSubscription?.unsubscribe();
    this.rideSubscription = this.cable.subscribeToClientRide(rideId).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          console.log('[Cliente] Evento recebido via WebSocket:', data);
          if ((data.event === 'RIDE_STATUS_UPDATED' || data.event === 'RIDE_CANCELLED' || data.event === 'RIDE_COMPLETED') && this.currentRide) {
            this.currentRide = {
              ...this.currentRide,
              status: data.status,
              driver_id: data.driver_id
            };
            if (data.driver) {
              this.driverInfo = data.driver;
            } else if (data.driver_id) {
              this.fetchDriverInfo(data.driver_id);
            }

            this.handleStatusChange(data.status, data);
            this.syncService.setActiveClientRide(this.currentRide);
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private handleStatusChange(status: string, data: any): void {
    const rideId = data.ride_id || data.id || this.currentRide?.id;
    if (this.lastNotifiedRideId === rideId && this.lastNotifiedStatus === status) {
      // Já notificou este status para esta corrida. Evita duplicidade de toast.
      return;
    }
    this.lastNotifiedRideId = rideId;
    this.lastNotifiedStatus = status;

    if (status === 'IN_PROGRESS') {
      this.successMessage = `Corrida aceita! O motorista está a caminho.`;
      this.errorMessage = '';
      this.toast.info('Corrida aceita! O motorista está a caminho.');
    } else if (status === 'COMPLETED') {
      this.successMessage = 'Corrida concluída com sucesso! Obrigado por viajar conosco.';
      this.errorMessage = '';
      this.toast.success('Sua corrida foi concluída! Obrigado por viajar conosco.');
    } else if (status === 'CANCELLED') {
      this.driverInfo = null;
      this.successMessage = '';
      if (data.cancelled_by === 'DRIVER') {
        this.errorMessage = 'Atenção: O motorista cancelou a corrida! Você pode solicitar um novo motorista.';
        this.toast.error('Atenção: O motorista cancelou a corrida!');
      } else if (data.cancelled_by === 'CLIENT') {
        this.errorMessage = 'A corrida foi cancelada.';
        this.toast.warning('A corrida foi cancelada.');
      } else {
        this.errorMessage = 'A corrida foi cancelada.';
        this.toast.warning('A corrida foi cancelada.');
      }
    }
  }

  cancelarCorrida(): void {
    if (!this.currentRide?.id) return;

    this.loading = true;
    this.api.cancelRide(this.currentRide.id, 'CLIENT').subscribe({
      next: () => {
        this.loading = false;
        if (this.currentRide) {
          this.currentRide = { ...this.currentRide, status: 'CANCELLED' };
        }
        this.driverInfo = null;
        this.successMessage = '';
        this.errorMessage = 'Você cancelou a corrida.';
        this.toast.warning('Você cancelou a corrida.');
        this.syncService.setActiveClientRide(null);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        const msg = err.error?.error || 'Erro ao cancelar corrida.';
        this.errorMessage = msg;
        this.toast.error(msg);
        this.cdr.detectChanges();
      }
    });
  }

  novaSolicitacao(): void {
    this.currentRide = null;
    this.driverInfo = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.lastNotifiedRideId = null;
    this.lastNotifiedStatus = null;
    this.syncService.setActiveClientRide(null);
    this.rideForm.patchValue({
      originAddress: '',
      destinationAddress: ''
    });
    this.cdr.detectChanges();
  }
}
