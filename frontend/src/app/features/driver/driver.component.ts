import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ActionCableService } from '../../core/services/actioncable.service';
import { RideSyncService } from '../../core/services/ride-sync.service';
import { ToastService } from '../../core/services/toast.service';
import { Ride, User } from '../../core/models/ride.model';

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver.component.html',
  styleUrls: ['./driver.component.scss']
})
export class DriverComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private cable = inject(ActionCableService);
  private syncService = inject(RideSyncService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  drivers: User[] = [];
  selectedDriverId = 'user-driver-1';
  availableRides: Ride[] = [];
  myAcceptedRides: Ride[] = [];
  myCompletedRides: (Ride & { driver?: User })[] = [];

  // Filtros de pesquisa por período e motorista
  filterDriverId = 'user-driver-1';
  filterStartDate = '';
  filterEndDate = '';
  filterStatus = 'ALL';
  filteredRides: (Ride & { driver?: User })[] = [];
  searching = false;

  errorMessage = '';
  successMessage = '';
  acceptingRideId: number | null = null;
  completingRideId: number | null = null;

  private driverRidesSub?: Subscription;
  private syncSub?: Subscription;

  ngOnInit(): void {
    const today = this.getTodayString();
    this.filterStartDate = today;
    this.filterEndDate = today;
    this.filterDriverId = this.selectedDriverId;

    this.loadDrivers();
    this.loadPendingRides();
    this.loadMyAcceptedRides();
    this.loadMyCompletedRides();
    this.pesquisarCorridas();
    this.connectWebSocket();
    this.listenToClientRideSync();
  }

  ngOnDestroy(): void {
    this.driverRidesSub?.unsubscribe();
    this.syncSub?.unsubscribe();
  }

  getTodayString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isToday(dateStr?: string | Date): boolean {
    if (!dateStr) return true;
    try {
      const targetDate = new Date(dateStr);
      const today = new Date();
      return (
        targetDate.getDate() === today.getDate() &&
        targetDate.getMonth() === today.getMonth() &&
        targetDate.getFullYear() === today.getFullYear()
      );
    } catch {
      return true;
    }
  }

  // Monitora alterações de cancelamento ou alteração de corridas no Painel do Cliente
  private listenToClientRideSync(): void {
    this.syncSub = this.syncService.activeClientRide$.subscribe((activeRide) => {
      this.ngZone.run(() => {
        if (!activeRide) return;

        if (activeRide.status === 'CANCELLED' && activeRide.id) {
          // Remove corrida cancelada pelo passageiro
          this.availableRides = this.availableRides.filter((r) => r.id !== activeRide.id);
          const wasAccepted = this.myAcceptedRides.some((r) => r.id === activeRide.id);
          if (wasAccepted) {
            this.myAcceptedRides = this.myAcceptedRides.filter((r) => r.id !== activeRide.id);
            this.errorMessage = `Atenção: O passageiro cancelou a corrida #${activeRide.id}!`;
            this.toast.error(`Atenção: O passageiro cancelou a corrida #${activeRide.id}!`);
          }
          this.pesquisarCorridas();
          this.cdr.detectChanges();
        } else if (activeRide.status === 'IN_PROGRESS' && activeRide.driver_id !== this.selectedDriverId) {
          // Se outro motorista aceitou, retira da lista de disponíveis
          this.availableRides = this.availableRides.filter((r) => r.id !== activeRide.id);
          this.cdr.detectChanges();
        }
      });
    });
  }

  onDriverChange(): void {
    this.filterDriverId = this.selectedDriverId;
    this.loadPendingRides();
    this.loadMyAcceptedRides();
    this.loadMyCompletedRides();
    this.pesquisarCorridas();
  }

  pesquisarCorridas(): void {
    this.searching = true;
    this.api.getRides({
      driver_id: this.filterDriverId,
      start_date: this.filterStartDate,
      end_date: this.filterEndDate,
      status: this.filterStatus
    }).subscribe({
      next: (rides) => {
        this.ngZone.run(() => {
          this.searching = false;
          this.filteredRides = rides;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.searching = false;
          console.error('Erro ao pesquisar corridas', err);
          this.toast.error('Erro ao pesquisar corridas.');
          this.cdr.detectChanges();
        });
      }
    });
  }

  definirFiltroHoje(): void {
    const today = this.getTodayString();
    this.filterStartDate = today;
    this.filterEndDate = today;
    this.pesquisarCorridas();
  }

  limparFiltros(): void {
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterStatus = 'ALL';
    this.filterDriverId = 'ALL';
    this.pesquisarCorridas();
  }

  loadDrivers(): void {
    this.api.getUsers('DRIVER').subscribe({
      next: (drivers) => {
        this.ngZone.run(() => {
          this.drivers = drivers;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.drivers = [
          { id: 'user-driver-1', name: 'João Pedro (Motorista)', role: 'DRIVER', email: 'joao@exemplo.com', vehicle: 'Toyota Corolla - ABC-1234' },
          { id: 'user-driver-2', name: 'Ana Oliveira (Motorista)', role: 'DRIVER', email: 'ana@exemplo.com', vehicle: 'Honda Civic - XYZ-9876' }
        ];
      }
    });
  }

  loadPendingRides(): void {
    const today = this.getTodayString();
    this.api.getRides({
      status: 'PENDING',
      start_date: today,
      end_date: today
    }).subscribe({
      next: (rides) => {
        this.ngZone.run(() => {
          this.availableRides = rides.filter(r => this.isToday(r.created_at));
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('Erro ao carregar corridas pendentes do dia', err);
        // Fallback buscando PENDING e filtrando pela data localmente
        this.api.getRides('PENDING').subscribe({
          next: (fallbackRides) => {
            this.ngZone.run(() => {
              this.availableRides = fallbackRides.filter(r => this.isToday(r.created_at));
              this.cdr.detectChanges();
            });
          }
        });
      }
    });
  }

  loadMyAcceptedRides(): void {
    this.api.getRides('IN_PROGRESS').subscribe({
      next: (rides: any[]) => {
        this.ngZone.run(() => {
          this.myAcceptedRides = rides.filter(r => r.driver_id === this.selectedDriverId);
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Erro ao carregar corridas aceitas', err)
    });
  }

  loadMyCompletedRides(): void {
    this.api.getRides('COMPLETED').subscribe({
      next: (rides: any[]) => {
        this.ngZone.run(() => {
          this.myCompletedRides = rides.filter(r => r.driver_id === this.selectedDriverId);
          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Erro ao carregar corridas concluídas', err)
    });
  }

  connectWebSocket(): void {
    this.driverRidesSub?.unsubscribe();
    this.driverRidesSub = this.cable.subscribeToDriverRides().subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          console.log('[Motorista] Evento WebSocket recebido:', data);

          if (data.event === 'NEW_RIDE_AVAILABLE' && data.ride) {
            if (this.isToday(data.ride.created_at)) {
              const exists = this.availableRides.some(r => r.id === data.ride.id);
              if (!exists) {
                this.availableRides = [data.ride, ...this.availableRides];
                this.toast.info(`Nova corrida disponível: #${data.ride.id}`);
                this.pesquisarCorridas();
                this.cdr.detectChanges();
              }
            }
          } else if (data.event === 'RIDE_TAKEN' && data.ride_id) {
            this.availableRides = this.availableRides.filter(r => r.id !== data.ride_id);
            this.pesquisarCorridas();
            this.cdr.detectChanges();
          } else if (data.event === 'RIDE_CANCELLED' && data.ride_id) {
            this.handleRideCancelled(data);
          } else if (data.event === 'RIDE_COMPLETED' && data.ride_id) {
            this.myAcceptedRides = this.myAcceptedRides.filter(r => r.id !== data.ride_id);
            this.loadMyCompletedRides();
            this.pesquisarCorridas();
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  private handleRideCancelled(data: any): void {
    const rideId = data.ride_id;
    const cancelledBy = data.cancelled_by;
    const driverId = data.driver_id;

    const acceptedIndex = this.myAcceptedRides.findIndex(r => r.id === rideId);
    const wasAccepted = acceptedIndex !== -1;
    const wasAvailable = this.availableRides.some(r => r.id === rideId);

    if (wasAccepted) {
      this.myAcceptedRides = this.myAcceptedRides.filter(r => r.id !== rideId);
    }
    if (wasAvailable) {
      this.availableRides = this.availableRides.filter(r => r.id !== rideId);
    }

    if (cancelledBy === 'CLIENT') {
      if (wasAccepted || (driverId && driverId === this.selectedDriverId)) {
        this.errorMessage = `Atenção: O passageiro desistiu/cancelou a corrida #${rideId}!`;
        this.successMessage = '';
        this.toast.error(`Atenção: O passageiro cancelou a corrida #${rideId}!`);
        this.pesquisarCorridas();
      } else if (wasAvailable) {
        this.toast.info(`A corrida #${rideId} foi cancelada pelo passageiro.`);
        this.pesquisarCorridas();
      }
    } else if (cancelledBy === 'DRIVER') {
      if (wasAccepted && driverId === this.selectedDriverId) {
        this.successMessage = `Corrida #${rideId} cancelada por você.`;
        this.toast.warning(`Corrida #${rideId} cancelada por você.`);
        this.pesquisarCorridas();
      }
    }
    this.cdr.detectChanges();
  }

  cancelarCorridaPeloMotorista(ride: Ride): void {
    if (!ride.id) return;
    this.errorMessage = '';
    this.successMessage = '';

    this.api.cancelRide(ride.id, 'DRIVER').subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.myAcceptedRides = this.myAcceptedRides.filter(r => r.id !== ride.id);
          this.successMessage = `Você cancelou a corrida #${ride.id}.`;
          this.toast.warning(`Você cancelou a corrida #${ride.id}.`);
          this.syncService.setActiveClientRide(null);
          this.pesquisarCorridas();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          const msg = err.error?.error || 'Erro ao cancelar a corrida.';
          this.errorMessage = msg;
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      }
    });
  }

  aceitarCorrida(ride: Ride): void {
    if (!ride.id) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.acceptingRideId = ride.id;

    this.api.acceptRide(ride.id, this.selectedDriverId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.acceptingRideId = null;
          this.successMessage = `Sucesso! Você aceitou a corrida #${ride.id}.`;
          this.toast.success(`Você aceitou a corrida #${ride.id}!`);

          // Remove da lista de disponíveis
          this.availableRides = this.availableRides.filter(r => r.id !== ride.id);

          const currentDriver = this.drivers.find(d => d.id === this.selectedDriverId);
          const acceptedRide: Ride = {
            ...ride,
            ...res.ride,
            status: 'IN_PROGRESS',
            driver_id: this.selectedDriverId,
            driver: res.ride?.driver || currentDriver
          };

          // Adiciona ao topo das corridas aceitas
          this.myAcceptedRides = [acceptedRide, ...this.myAcceptedRides.filter(r => r.id !== ride.id)];

          // Sincroniza imediatamente com o painel do cliente
          this.syncService.setActiveClientRide(acceptedRide);

          // Atualiza histórico/consulta
          this.pesquisarCorridas();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.acceptingRideId = null;
          const msg = err.error?.error || 'Não foi possível aceitar a corrida.';
          this.errorMessage = msg;
          this.toast.error(msg);

          if (err.status === 409) {
            this.availableRides = this.availableRides.filter(r => r.id !== ride.id);
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  concluirCorrida(ride: Ride): void {
    if (!ride.id) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.completingRideId = ride.id;

    this.api.completeRide(ride.id, this.selectedDriverId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.completingRideId = null;
          this.myAcceptedRides = this.myAcceptedRides.filter(r => r.id !== ride.id);

          const currentDriver = this.drivers.find(d => d.id === this.selectedDriverId);
          const completedRide: Ride = {
            ...ride,
            ...res.ride,
            status: 'COMPLETED',
            driver_id: this.selectedDriverId,
            driver: res.ride?.driver || currentDriver
          };

          this.myCompletedRides = [completedRide, ...this.myCompletedRides.filter(r => r.id !== ride.id)];
          this.successMessage = `Sucesso! Corrida #${ride.id} concluída. Motorista: ${completedRide.driver?.name || this.selectedDriverId}.`;
          this.toast.success(`Corrida #${ride.id} concluída com sucesso!`);

          this.syncService.setActiveClientRide(completedRide);
          this.pesquisarCorridas();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.completingRideId = null;
          const msg = err.error?.error || 'Erro ao concluir corrida.';
          this.errorMessage = msg;
          this.toast.error(msg);
          this.cdr.detectChanges();
        });
      }
    });
  }

  getDriverName(driverId?: string | null): string {
    if (!driverId) return 'Motorista não identificado';
    const d = this.drivers.find(x => x.id === driverId);
    return d ? d.name : driverId;
  }

  getDriverVehicle(driverId?: string | null): string {
    if (!driverId) return '';
    const d = this.drivers.find(x => x.id === driverId);
    return d?.vehicle || '';
  }

  rejeitarCorrida(rideId: number | undefined): void {
    if (!rideId) return;
    this.availableRides = this.availableRides.filter(r => r.id !== rideId);
    this.cdr.detectChanges();
  }
}
