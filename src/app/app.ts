import { Component, ViewChild } from '@angular/core'; // Added ViewChild
import { Sheet } from './components/sheet/sheet';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav'; // Added MatSidenav
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { SideMenuComponent } from './components/side-menu/side-menu';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-root',
  imports: [
    Sheet,
    MatSidenavModule,
    MatListModule,
    MatToolbarModule,
    MatIconModule,
    SideMenuComponent,
    CommonModule // Added CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected title = 'taylored-snippets-web';

  @ViewChild('sidenav') sidenav!: MatSidenav; // Added ViewChild for sidenav
}
