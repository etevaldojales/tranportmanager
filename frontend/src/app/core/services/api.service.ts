import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Ride, User } from '../models/ride.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  // URL base apontando para o API Gateway
  private baseUrl = 'http://localhost:8080';

  // Account Service
  getUsers(role?: 'CLIENT' | 'DRIVER'): Observable<User[]> {
    const url = role ? `${this.baseUrl}/api/accounts/users?role=${role}` : `${this.baseUrl}/api/accounts/users`;
    return this.http.get<User[]>(url);
  }

  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/api/accounts/users/${userId}`);
  }

  // Ride Service
  getRides(filterOrStatus?: string | {
    status?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
  }): Observable<Ride[]> {
    let url = `${this.baseUrl}/api/rides`;
    if (typeof filterOrStatus === 'string') {
      url += `?status=${filterOrStatus}`;
      return this.http.get<Ride[]>(url);
    }
    if (filterOrStatus) {
      const parts: string[] = [];
      if (filterOrStatus.status && filterOrStatus.status !== 'ALL') parts.push(`status=${filterOrStatus.status}`);
      if (filterOrStatus.driver_id && filterOrStatus.driver_id !== 'ALL') parts.push(`driver_id=${filterOrStatus.driver_id}`);
      if (filterOrStatus.start_date) parts.push(`start_date=${filterOrStatus.start_date}`);
      if (filterOrStatus.end_date) parts.push(`end_date=${filterOrStatus.end_date}`);
      if (parts.length > 0) {
        url += `?${parts.join('&')}`;
      }
    }
    return this.http.get<Ride[]>(url);
  }

  getRideById(rideId: number): Observable<Ride> {
    return this.http.get<Ride>(`${this.baseUrl}/api/rides/${rideId}`);
  }

  createRide(ride: { user_id: string; origin_address: string; destination_address: string }): Observable<Ride> {
    return this.http.post<Ride>(`${this.baseUrl}/api/rides`, { ride });
  }

  acceptRide(rideId: number, driverId: string): Observable<{ message: string; ride: Ride }> {
    return this.http.post<{ message: string; ride: Ride }>(`${this.baseUrl}/api/rides/${rideId}/accept`, {
      driver_id: driverId
    });
  }

  cancelRide(rideId: number, cancelledBy: 'CLIENT' | 'DRIVER' = 'CLIENT', reason?: string): Observable<{ message: string; ride: Ride; cancelled_by?: string }> {
    return this.http.post<{ message: string; ride: Ride; cancelled_by?: string }>(`${this.baseUrl}/api/rides/${rideId}/cancel`, {
      cancelled_by: cancelledBy,
      reason: reason
    });
  }

  completeRide(rideId: number, driverId: string): Observable<{ message: string; ride: Ride & { driver?: User } }> {
    return this.http.post<{ message: string; ride: Ride & { driver?: User } }>(`${this.baseUrl}/api/rides/${rideId}/complete`, {
      driver_id: driverId
    });
  }
}

