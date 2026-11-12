import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ClientComponent } from './features/client/client.component';
import { DriverComponent } from './features/driver/driver.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ClientComponent, DriverComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'TransportManager - PGE-CE';
  splitViewMode = false;

  toggleSplitView(): void {
    this.splitViewMode = !this.splitViewMode;
  }
}
