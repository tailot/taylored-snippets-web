/**
 * @fileoverview Defines the SideMenuComponent, which displays a list of selectable menu items.
 */
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MenuItem } from './menu-item';
import { Snippet } from '../sheet/sheet';

/**
 * The SideMenuComponent is responsible for rendering the side navigation menu.
 * It receives a list of menu items and emits an event when an item's snippets are selected.
 */
@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [MatListModule],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.sass'
})
export class SideMenuComponent {
  /**
   * An array of MenuItem objects to be displayed in the side menu.
   * This is an input property, typically bound from a parent component.
   */
  @Input() menuItems: MenuItem[] = [];

  /**
   * An EventEmitter that emits an array of Snippet objects when a menu item is clicked.
   * This allows parent components to react to snippet selections.
   */
  @Output() snippetsSelected = new EventEmitter<Snippet[]>();

  /**
   * Handles the click event on a menu item.
   * It emits the `snippetsSelected` event with the snippets associated with the clicked item.
   * @param item The MenuItem that was clicked.
   */
  onItemClick(item: MenuItem) {
    this.snippetsSelected.emit(item.snippets);
  }
}
