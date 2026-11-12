import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DriverComponent } from './driver.component';
import { ApiService } from '../../core/services/api.service';
import { ActionCableService } from '../../core/services/actioncable.service';
import { RideSyncService } from '../../core/services/ride-sync.service';
import { ToastService } from '../../core/services/toast.service';
import { of, throwError } from 'rxjs';
import { Ride } from '../../core/models/ride.model';

describe('DriverComponent', () => {
  let component: DriverComponent;
  let fixture: ComponentFixture<DriverComponent>;
  let apiServiceMock: jasmine.SpyObj<ApiService>;
  let cableServiceMock: jasmine.SpyObj<ActionCableService>;
  let syncServiceMock: jasmine.SpyObj<RideSyncService>;
  let toastServiceMock: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    apiServiceMock = jasmine.createSpyObj('ApiService', ['getUsers', 'getRides', 'acceptRide', 'cancelRide', 'completeRide']);
    cableServiceMock = jasmine.createSpyObj('ActionCableService', ['subscribeToDriverRides']);
    syncServiceMock = jasmine.createSpyObj('RideSyncService', ['isRideAvailableInClient'], {
      activeClientRide$: of(null)
    });
    toastServiceMock = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);

    apiServiceMock.getUsers.and.returnValue(of([
      { id: 'user-driver-1', name: 'João', role: 'DRIVER', email: 'joao@exemplo.com' }
    ]));
    apiServiceMock.getRides.and.returnValue(of([]));
    apiServiceMock.cancelRide.and.returnValue(of({ message: 'Cancelada', ride: {} as any }));
    apiServiceMock.completeRide.and.returnValue(of({ message: 'Concluída', ride: { id: 50, status: 'COMPLETED', driver_id: 'user-driver-1' } as any }));
    cableServiceMock.subscribeToDriverRides.and.returnValue(of());
    syncServiceMock.isRideAvailableInClient.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [DriverComponent],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: ActionCableService, useValue: cableServiceMock },
        { provide: RideSyncService, useValue: syncServiceMock },
        { provide: ToastService, useValue: toastServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DriverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser instanciado corretamente', () => {
    expect(component).toBeTruthy();
  });

  it('deve aceitar uma corrida com sucesso', () => {
    const mockRide: Ride = {
      id: 10,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'PENDING'
    };
    component.availableRides = [mockRide];

    apiServiceMock.acceptRide.and.returnValue(of({
      message: 'Corrida aceita com sucesso!',
      ride: { ...mockRide, status: 'IN_PROGRESS', driver_id: 'user-driver-1' }
    }));

    component.aceitarCorrida(mockRide);

    expect(apiServiceMock.acceptRide).toHaveBeenCalledWith(10, 'user-driver-1');
    expect(component.availableRides.find(r => r.id === 10)).toBeUndefined();
    expect(component.myAcceptedRides.length).toBe(1);
  });

  it('deve tratar conflito de concorrência (409) removendo a corrida da lista', () => {
    const mockRide: Ride = {
      id: 20,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'PENDING'
    };
    component.availableRides = [mockRide];

    apiServiceMock.acceptRide.and.returnValue(throwError(() => ({
      status: 409,
      error: { error: 'Esta corrida já foi aceita por outro motorista.' }
    })));

    component.aceitarCorrida(mockRide);

    expect(component.errorMessage).toContain('Esta corrida já foi aceita');
    expect(component.availableRides.find(r => r.id === 20)).toBeUndefined();
  });

  it('deve alertar o motorista quando o passageiro cancelar/desistir da corrida', () => {
    const mockRide: Ride = {
      id: 30,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };
    component.myAcceptedRides = [mockRide];

    component['handleRideCancelled']({
      event: 'RIDE_CANCELLED',
      ride_id: 30,
      driver_id: 'user-driver-1',
      cancelled_by: 'CLIENT'
    });

    expect(component.myAcceptedRides.length).toBe(0);
    expect(component.errorMessage).toContain('O passageiro desistiu/cancelou a corrida #30');
  });

  it('deve permitir que o motorista cancele a corrida em andamento', () => {
    const mockRide: Ride = {
      id: 40,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };
    component.myAcceptedRides = [mockRide];
    apiServiceMock.cancelRide.and.returnValue(of({ message: 'Corrida cancelada.', ride: mockRide }));

    component.cancelarCorridaPeloMotorista(mockRide);

    expect(apiServiceMock.cancelRide).toHaveBeenCalledWith(40, 'DRIVER');
    expect(component.myAcceptedRides.length).toBe(0);
    expect(component.successMessage).toContain('Você cancelou a corrida #40');
  });

  it('deve verificar e remover do painel do motorista as corridas não mais disponíveis no painel do cliente', () => {
    const mockRide1: Ride = { id: 1, user_id: 'user-client-1', origin_address: 'Rua A', destination_address: 'Rua B', status: 'PENDING' };
    const mockRide3: Ride = { id: 3, user_id: 'user-client-2', origin_address: 'Rua C', destination_address: 'Rua D', status: 'PENDING' };

    apiServiceMock.getRides.and.returnValue(of([mockRide1, mockRide3]));
    syncServiceMock.isRideAvailableInClient.and.returnValue(false);

    component.loadPendingRides();

    expect(component.availableRides.length).toBe(0);
    expect(apiServiceMock.cancelRide).toHaveBeenCalledWith(1, 'CLIENT', jasmine.any(String));
    expect(apiServiceMock.cancelRide).toHaveBeenCalledWith(3, 'CLIENT', jasmine.any(String));
  });

  it('deve permitir que o motorista conclua a corrida atualizando a lista identificando o motorista', () => {
    const mockRide: Ride = {
      id: 50,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };
    component.myAcceptedRides = [mockRide];

    const completedMockRide = {
      ...mockRide,
      status: 'COMPLETED' as const,
      driver: { id: 'user-driver-1', name: 'João Pedro', vehicle: 'Toyota Corolla', role: 'DRIVER' as const, email: 'joao@exemplo.com' }
    };
    apiServiceMock.completeRide.and.returnValue(of({ message: 'Corrida concluída com sucesso!', ride: completedMockRide }));

    component.concluirCorrida(mockRide);

    expect(apiServiceMock.completeRide).toHaveBeenCalledWith(50, 'user-driver-1');
    expect(component.myAcceptedRides.length).toBe(0);
    expect(component.myCompletedRides.length).toBe(1);
    expect(component.myCompletedRides[0].driver?.name).toBe('João Pedro');
    expect(component.successMessage).toContain('Corrida #50 concluída');
  });

  it('deve pesquisar corridas por motorista e período de datas e exibir status', () => {
    const mockRides: Ride[] = [
      { id: 1, user_id: 'user-client-1', driver_id: 'user-driver-1', status: 'COMPLETED', origin_address: 'A', destination_address: 'B' },
      { id: 2, user_id: 'user-client-2', driver_id: 'user-driver-1', status: 'CANCELLED', origin_address: 'C', destination_address: 'D' },
      { id: 3, user_id: 'user-client-1', driver_id: 'user-driver-1', status: 'PENDING', origin_address: 'E', destination_address: 'F' }
    ];
    apiServiceMock.getRides.and.returnValue(of(mockRides));

    component.filterDriverId = 'user-driver-1';
    component.filterStartDate = '2026-11-12';
    component.filterEndDate = '2026-11-12';
    component.filterStatus = 'ALL';

    component.pesquisarCorridas();

    expect(apiServiceMock.getRides).toHaveBeenCalledWith({
      driver_id: 'user-driver-1',
      start_date: '2026-11-12',
      end_date: '2026-11-12',
      status: 'ALL'
    });
    expect(component.filteredRides.length).toBe(3);
    const statuses = component.filteredRides.map(r => r.status);
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('CANCELLED');
    expect(statuses).toContain('PENDING');
  });
});

