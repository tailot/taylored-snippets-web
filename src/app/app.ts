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
  protected title = 'taylored-snippets-web';
  @ViewChild('sidenav') sidenav!: MatSidenav;
  @ViewChild(Sheet) sheetComponent!: Sheet;

  public sideMenuItems: MenuItem[] = [];

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

  ngOnInit() {
    this.runnerService.provisionRunner().catch(error => {
      console.error('Error provisioning runner:', error);
    });
  }

  public onSnippetsSelected(snippets: Snippet[]) {
    this.sheetComponent.populateSnippets(snippets);
  }

  public onNewMenuItem(menuItem: MenuItem): void {
    this.sideMenuItems.push(menuItem);
  }
}
