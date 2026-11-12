import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientComponent } from './client.component';
import { ApiService } from '../../core/services/api.service';
import { ActionCableService } from '../../core/services/actioncable.service';
import { ToastService } from '../../core/services/toast.service';
import { of, throwError, Subject } from 'rxjs';

describe('ClientComponent', () => {
  let component: ClientComponent;
  let fixture: ComponentFixture<ClientComponent>;
  let apiServiceMock: jasmine.SpyObj<ApiService>;
  let cableServiceMock: jasmine.SpyObj<ActionCableService>;
  let toastServiceMock: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    apiServiceMock = jasmine.createSpyObj('ApiService', ['getUsers', 'createRide', 'cancelRide']);
    cableServiceMock = jasmine.createSpyObj('ActionCableService', ['subscribeToClientRide']);
    toastServiceMock = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info']);

    apiServiceMock.getUsers.and.returnValue(of([
      { id: 'user-client-1', name: 'Carlos', role: 'CLIENT', email: 'carlos@exemplo.com' }
    ]));
    cableServiceMock.subscribeToClientRide.and.returnValue(of());

    await TestBed.configureTestingModule({
      imports: [ClientComponent],
      providers: [
        { provide: ApiService, useValue: apiServiceMock },
        { provide: ActionCableService, useValue: cableServiceMock },
        { provide: ToastService, useValue: toastServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser instanciado corretamente', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar o formulário com valores padrão e inválido se campos vazios', () => {
    expect(component.rideForm).toBeDefined();
    expect(component.rideForm.get('userId')?.value).toBe('user-client-1');
    expect(component.rideForm.valid).toBeFalse();
  });

  it('deve rejeitar submissão com endereços de partida e destino iguais', () => {
    component.rideForm.setValue({
      userId: 'user-client-1',
      originAddress: 'Av. Paulista, 100',
      destinationAddress: 'Av. Paulista, 100'
    });

    component.solicitarCorrida();

    expect(component.errorMessage).toBe('O endereço de partida e destino não podem ser iguais.');
    expect(apiServiceMock.createRide).not.toHaveBeenCalled();
  });

  it('deve chamar a API para criar a corrida com sucesso quando os campos forem válidos', () => {
    const mockCreatedRide = {
      id: 1,
      user_id: 'user-client-1',
      origin_address: 'Av. Santos Dumont, 100',
      destination_address: 'Av. Beira Mar, 500',
      status: 'PENDING' as const
    };
    apiServiceMock.createRide.and.returnValue(of(mockCreatedRide));

    component.rideForm.setValue({
      userId: 'user-client-1',
      originAddress: 'Av. Santos Dumont, 100',
      destinationAddress: 'Av. Beira Mar, 500'
    });

    component.solicitarCorrida();

    expect(apiServiceMock.createRide).toHaveBeenCalledWith({
      user_id: 'user-client-1',
      origin_address: 'Av. Santos Dumont, 100',
      destination_address: 'Av. Beira Mar, 500'
    });
    expect(component.currentRide).toEqual(mockCreatedRide);
    expect(cableServiceMock.subscribeToClientRide).toHaveBeenCalledWith(1);
  });

  it('deve exibir alerta para o cliente quando o motorista cancelar a corrida via WebSocket', () => {
    const wsSubject = new Subject<any>();
    cableServiceMock.subscribeToClientRide.and.returnValue(wsSubject.asObservable());

    component.currentRide = {
      id: 5,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };

    component['listenToRideUpdates'](5);

    wsSubject.next({
      event: 'RIDE_CANCELLED',
      ride_id: 5,
      status: 'CANCELLED',
      cancelled_by: 'DRIVER'
    });

    expect(component.currentRide.status).toBe('CANCELLED');
    expect(component.driverInfo).toBeNull();
    expect(component.errorMessage).toContain('O motorista cancelou a corrida');
  });

  it('deve chamar a API para cancelar a corrida pelo cliente', () => {
    component.currentRide = {
      id: 5,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };
    apiServiceMock.cancelRide.and.returnValue(of({ message: 'Corrida cancelada.', ride: component.currentRide }));

    component.cancelarCorrida();

    expect(apiServiceMock.cancelRide).toHaveBeenCalledWith(5, 'CLIENT');
    expect(component.currentRide.status).toBe('CANCELLED');
    expect(component.errorMessage).toBe('Você cancelou a corrida.');
  });

  it('deve atualizar para concluída e identificar motorista quando a corrida for finalizada via WebSocket', () => {
    const wsSubject = new Subject<any>();
    cableServiceMock.subscribeToClientRide.and.returnValue(wsSubject.asObservable());

    component.currentRide = {
      id: 6,
      user_id: 'user-client-1',
      origin_address: 'Rua A',
      destination_address: 'Rua B',
      status: 'IN_PROGRESS',
      driver_id: 'user-driver-1'
    };

    component['listenToRideUpdates'](6);

    wsSubject.next({
      event: 'RIDE_COMPLETED',
      ride_id: 6,
      status: 'COMPLETED',
      driver_id: 'user-driver-1',
      driver: { id: 'user-driver-1', name: 'João Pedro', vehicle: 'Toyota Corolla' }
    });

    expect(component.currentRide.status).toBe('COMPLETED');
    expect(component.driverInfo.name).toBe('João Pedro');
    expect(component.successMessage).toContain('Corrida concluída com sucesso');
  });
});

