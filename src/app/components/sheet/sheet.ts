import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common'; // For *ngFor, *ngIf, etc.
import { SnippetText } from '../snippet-text/snippet-text';
import { SnippetCompute } from '../snippet-compute/snippet-compute';

export interface Snippet {
  id: number;
  type: 'text' | 'compute';
  getTayloredBlock(): XMLDocument;
}

@Component({
  selector: 'app-sheet',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, SnippetText, SnippetCompute],
  standalone: true,
  templateUrl: './sheet.html',
  styleUrl: './sheet.sass'
})
export class Sheet {
  snippets: Snippet[] = [];
  private nextId = 0;

  addSnippet(type: 'text' | 'compute'): void {
    this.snippets.push({ id: this.nextId++, type: type });
  }
  removeSnippet(id: number): void {
    this.snippets = this.snippets.filter(snippet => snippet.id !== id);
  }

  saveSheet(): void {
    // TODO: Implement save functionality
  }
}
