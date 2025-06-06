import { Component, Input } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MenuItem } from './menu-item';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [MatListModule],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.sass'
})
export class SideMenuComponent {
  @Input() menuItems: MenuItem[] = [];
}
