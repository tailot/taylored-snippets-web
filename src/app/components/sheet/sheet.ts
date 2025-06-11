import { Component, HostListener, inject, ChangeDetectorRef, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { SnippetText } from '../snippet-text/snippet-text';
import { SnippetCompute } from '../snippet-compute/snippet-compute';
/**
 * @fileoverview Defines the Sheet component, which manages a collection of snippets (text or compute).
 * It allows users to add, remove, reorder, save, and load snippets.
 */
import { RunnerService } from '../../services/runner.service';
import { MenuItem } from '../side-menu/menu-item';

/**
 * Represents a snippet, which can be either a text block or a compute block.
 */
export interface Snippet {
  /** A unique identifier for the snippet. */
  id: number;
  /** The type of the snippet, determining its behavior and rendering. */
  type: 'text' | 'compute';
  /**
   * Retrieves the Taylored block representation of the snippet.
   * This is used for serialization and interaction with the runner.
   * @returns An XMLDocument representing the snippet's Taylored block.
   */
  getTayloredBlock(): string;
  /** Optional output from the execution of a compute snippet. */
  output?: string;
  /** The primary content or value of the snippet (e.g., text content or code). */
  value: string;
}

/**
 * The Sheet component acts as a container for managing and displaying snippets.
 * It supports operations like adding, updating, deleting, reordering, saving, and loading snippets.
 */
@Component({
  selector: 'app-sheet',
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, SnippetText, SnippetCompute, DragDropModule],
  standalone: true,
  templateUrl: './sheet.html',
  styleUrl: './sheet.sass'
})
export class Sheet { // Removed OnInit, OnDestroy as file manager logic is moved
  /**
   * Array holding all the snippets currently on the sheet.
   */
  snippets: Snippet[] = [];
  /**
   * Counter to generate unique IDs for new snippets.
   */
  private nextId = 0;
  private runnerService = inject(RunnerService);
  private cdr = inject(ChangeDetectorRef);
  /**
   * Emits an event when a new menu item should be created, typically after a compute snippet execution.
   */
  @Output() newMenuItem = new EventEmitter<MenuItem>();
  /**
   * Counter for naming menu items created from executions.
   */
  private executionCounter: number = 1;

  /**
   * Adds a new snippet of the specified type to the sheet.
   * @param type The type of snippet to add ('text' or 'compute').
   */
  addSnippet(type: 'text' | 'compute'): void {
    let newSnippet: Snippet;
    const currentId = this.nextId++;

    if (type === 'text') {
      newSnippet = new SnippetText();
    } else { // type === 'compute'
      newSnippet = new SnippetCompute();
    }

    newSnippet.id = currentId;
    // The 'type' property is already set in the respective class constructors/definitions.
    this.snippets.push(newSnippet);
  }

  /**
   * Updates an existing snippet or removes it if its value is empty.
   * @param ret The snippet instance (either SnippetText or SnippetCompute) that has been updated.
   */
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

  /**
   * Saves the current state of all snippets on the sheet to a JSON file.
   * The file is then downloaded by the user's browser.
   */
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

  /**
   * Handles the dropping of a snippet within the sheet, allowing reordering.
   * @param event The CdkDragDrop event containing information about the drag operation.
   */
  drop(event: CdkDragDrop<Snippet[]>): void {
    moveItemInArray(this.snippets, event.previousIndex, event.currentIndex);
  }

  /**
   * Populates the sheet with a given array of snippets.
   * This is typically used when loading snippets from the side menu.
   * @param newSnippets An array of Snippet objects.
   */
  populateSnippets(newSnippets: Snippet[]): void {
    this.snippets = newSnippets;
  }

  /**
   * Handles the 'dragover' event to allow dropping files onto the sheet.
   * @param event The DragEvent.
   */
  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Handles the 'drop' event, specifically for loading snippets from a dropped JSON file.
   * It reads the file, parses the JSON, and hydrates the snippets.
   * @param event The DragEvent, which may contain dropped files.
   */
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
            newSnippet = new SnippetCompute();
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

  /**
   * Handles the completion of processing for a compute snippet.
   * It creates a new menu item representing the state of the sheet at this execution point.
   * @param snippetComputeInstance The SnippetCompute instance that finished processing.
   */
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
