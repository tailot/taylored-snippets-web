import { Component, HostListener, inject, ChangeDetectorRef, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { SnippetText } from '../snippet-text/snippet-text';
import { SnippetCompute } from '../snippet-compute/snippet-compute';
import { RunnerService } from '../../services/runner.service';
import { MenuItem } from '../side-menu/menu-item';

export interface Snippet {
  id: number;
  type: 'text' | 'compute';
  getTayloredBlock(): XMLDocument;
  output?: string;
  value: string;
}

@Component({
  selector: 'app-sheet',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, SnippetText, SnippetCompute, DragDropModule],
  standalone: true,
  templateUrl: './sheet.html',
  styleUrl: './sheet.sass'
})
export class Sheet { // Removed OnInit, OnDestroy as file manager logic is moved
  snippets: Snippet[] = [];
  private nextId = 0;
  private runnerService = inject(RunnerService);
  private cdr = inject(ChangeDetectorRef);
  @Output() newMenuItem = new EventEmitter<MenuItem>();
  private executionCounter: number = 1;

  addSnippet(type: 'text' | 'compute'): void {
    let newSnippet: Snippet;
    const currentId = this.nextId++;

    if (type === 'text') {
      newSnippet = new SnippetText();
    } else { // type === 'compute'
      newSnippet = new SnippetCompute(this.runnerService, this.cdr);
    }

    newSnippet.id = currentId;
    // The 'type' property is already set in the respective class constructors/definitions.
    this.snippets.push(newSnippet);
  }
  updateSnippet(ret: SnippetText | SnippetCompute): void {
    if (ret.value === '') {
      this.snippets = this.snippets.filter(snippet => snippet.id !== ret.id);
    } else {
      const index = this.snippets.findIndex(snippet => snippet.id === ret.id);
      if (index !== -1) {
        this.snippets[index] = ret;
      }
    }
  }

  saveSheet(): void {
    if (this.snippets.length === 0) {
      return;
    }

    const serializableSnippets = this.snippets.map(snippet => ({
      id: snippet.id,
      type: snippet.type,
      output: snippet.output,
      value: snippet.value // Added this line
    }));

    const jsonString = JSON.stringify(serializableSnippets, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'snippets.json';
    document.body.appendChild(anchor); // Required for Firefox
    anchor.click();
    document.body.removeChild(anchor); // Clean up

    URL.revokeObjectURL(url);
  }

  drop(event: CdkDragDrop<Snippet[]>): void {
    moveItemInArray(this.snippets, event.previousIndex, event.currentIndex);
  }

  populateSnippets(newSnippets: Snippet[]): void {
    this.snippets = newSnippets;
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;

    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = () => {
        const text = reader.result as string;
        let parsedData;

        try {
          parsedData = JSON.parse(text);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          return;
        }

        if (!Array.isArray(parsedData)) {
          console.error('Parsed data is not an array.');
          return;
        }

        const hydratedSnippets: Snippet[] = [];
        for (const item of parsedData) {
          if (typeof item !== 'object' || item === null ||
            typeof item.id !== 'number' ||
            typeof item.type !== 'string' ||
            (item.type !== 'text' && item.type !== 'compute')) {
            console.error('Invalid item structure in parsed data. Aborting.');
            return;
          }

          let newSnippet: Snippet;
          if (item.type === 'text') {
            newSnippet = new SnippetText();
          } else { // item.type === 'compute'
            newSnippet = new SnippetCompute(this.runnerService, this.cdr);
          }

          newSnippet.id = item.id;
          if (typeof item.output === 'string') {
            newSnippet.output = item.output;
          }
          if (typeof item.value === 'string') { // Added this block
            newSnippet.value = item.value;
          } else {
            // If value is not present or not a string, initialize with empty string or default.
            // This handles cases where older format JSON might be dropped.
            newSnippet.value = '';
          }

          hydratedSnippets.push(newSnippet);
        }

        this.snippets = hydratedSnippets;
        if (this.snippets.length === 0) {
          this.nextId = 0;
        } else {
          this.nextId = Math.max(...this.snippets.map(s => s.id)) + 1;
        }
      };

      reader.onerror = (error) => {
        console.error('Error reading file:', error);
      };

      reader.readAsText(file);
    } else {
      console.log('No files dropped');
    }
  }

  public handleFinishedProcessing(snippetComputeInstance: SnippetCompute): void {
    const menuItem: MenuItem = {
      label: "Execution " + this.executionCounter,
      snippets: [...this.snippets] // Create a shallow copy
    };
    this.newMenuItem.emit(menuItem);
    this.executionCounter++;
  }

  // ngOnInit and ngOnDestroy related to file manager logic were removed.
  // listCurrentDirectory and downloadSelectedFile methods were removed.
}
