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
  @ViewChild(Sheet) sheetComponent!: Sheet;

  public sideMenuItems: MenuItem[] = [];

  constructor() {
    // Sample Snippets
    const sampleTextSnippet: Snippet = {
      id: 0, // ID will be managed by SheetComponent when added, but good for structure
      type: 'text',
      getTayloredBlock: () => {
        const doc = new DOMParser().parseFromString('<xml></xml>', 'application/xml');
        const textBlock = doc.createElement('text_block');
        textBlock.textContent = 'Sample text snippet content';
        doc.documentElement.appendChild(textBlock);
        return doc;
      },
      output: 'Initial text output if any'
    };

    const sampleComputeSnippet: Snippet = {
      id: 1,
      type: 'compute',
      getTayloredBlock: () => {
        const doc = new DOMParser().parseFromString('<xml></xml>', 'application/xml');
        const computeBlock = doc.createElement('compute_block');
        computeBlock.textContent = 'Sample compute snippet logic';
        doc.documentElement.appendChild(computeBlock);
        return doc;
      },
      output: 'Initial compute output if any'
    };

    // Sample MenuItems
    this.sideMenuItems = [
      {
        label: 'Menu Item 1 (Text)',
        snippets: [sampleTextSnippet]
      },
      {
        label: 'Menu Item 2 (Compute)',
        snippets: [sampleComputeSnippet]
      },
      {
        label: 'Menu Item 3 (Both)',
        snippets: [sampleTextSnippet, sampleComputeSnippet]
      },
      {
        label: 'Menu Item 4 (Empty)',
        snippets: []
      }
    ];
  }

  public onSnippetsSelected(snippets: Snippet[]) {
    this.sheetComponent.populateSnippets(snippets);
  }
}
