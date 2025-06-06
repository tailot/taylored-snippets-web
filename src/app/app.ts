import { Component, ViewChild } from '@angular/core';
import { Sheet, Snippet } from './components/sheet/sheet'; // Snippet import corretto
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { SideMenuComponent } from './components/side-menu/side-menu';
import { CommonModule } from '@angular/common';
import { MenuItem } from './components/side-menu/menu-item';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    Sheet,
    MatSidenavModule,
    MatListModule,
    MatToolbarModule,
    MatIconModule,
    SideMenuComponent,
    CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected title = 'taylored-snippets-web';
  @ViewChild('sidenav') sidenav!: MatSidenav;

  public sideMenuItems: MenuItem[] = [];
}
