import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MenuItem } from './menu-item';
import { Snippet } from '../sheet/sheet';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [MatListModule],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.sass'
})
export class SideMenuComponent {
  @Input() menuItems: MenuItem[] = [];
  @Output() snippetsSelected = new EventEmitter<Snippet[]>();

  onItemClick(item: MenuItem) {
    this.snippetsSelected.emit(item.snippets);
  }
}
