import { Routes } from '@angular/router';
import { ClientComponent } from './features/client/client.component';
import { DriverComponent } from './features/driver/driver.component';

export const routes: Routes = [
  { path: '', redirectTo: 'cliente', pathMatch: 'full' },
  { path: 'cliente', component: ClientComponent },
  { path: 'motorista', component: DriverComponent },
  { path: '**', redirectTo: 'cliente' }
];
