/**
 * @fileoverview This file defines the root component of the application.
 */
import { Component, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { Sheet, Snippet } from './components/sheet/sheet'; // Snippet import corretto
import { RunnerService } from './services/runner.service';
import { SideMenuComponent } from './components/side-menu/side-menu';
import { FileManagerComponent } from './components/file-manager/file-manager.component';
import { MenuItem } from './components/side-menu/menu-item';

/**
 * The root component of the application.
 */
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
    CommonModule,
    FileManagerComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App implements OnInit {
  /**
   * The title of the application.
   */
  protected title = 'taylored-snippets-web';
  /**
   * Reference to the sidenav component.
   */
  @ViewChild('sidenav') sidenav!: MatSidenav;
  /**
   * Reference to the sheet component.
   */
  @ViewChild(Sheet) sheetComponent!: Sheet;

  /**
   * Array of menu items for the side menu.
   */
  public sideMenuItems: MenuItem[] = [];

  /**
   * Constructs the App component.
   * @param runnerService The service for running code snippets.
   */
  constructor(private runnerService: RunnerService) {
    // Sample MenuItems
    // this.sideMenuItems = [
    //   {
    //     label: 'Menu Item 1 (Text)',
    //     snippets: [sampleTextSnippet]
    //   },
    //   {
    //     label: 'Menu Item 2 (Compute)',
    //     snippets: [sampleComputeSnippet]
    //   },
    //   {
    //     label: 'Menu Item 3 (Both)',
    //     snippets: [sampleTextSnippet, sampleComputeSnippet]
    //   },
    //   {
    //     label: 'Menu Item 4 (Empty)',
    //     snippets: []
    //   }
    // ];
  }

  /**
   * Initializes the component.
   * Provisions the runner service.
   */
  ngOnInit() {
    this.runnerService.provisionRunner().catch(error => {
      console.error('Error provisioning runner:', error);
    });
  }

  /**
   * Handles the selection of snippets from the side menu.
   * Populates the sheet component with the selected snippets.
   * @param snippets The array of snippets to display.
   */
  public onSnippetsSelected(snippets: Snippet[]) {
    this.sheetComponent.populateSnippets(snippets);
  }

  /**
   * Handles the creation of a new menu item.
   * Adds the new menu item to the side menu.
   * @param menuItem The new menu item to add.
   */
  public onNewMenuItem(menuItem: MenuItem): void {
    this.sideMenuItems.push(menuItem);
  }
}
