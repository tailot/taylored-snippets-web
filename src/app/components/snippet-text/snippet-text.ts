import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
/**
 * @fileoverview Defines the SnippetText component, which represents a non-executable text block.
 */
import { TextFieldModule } from '@angular/cdk/text-field';

import { Snippet } from '../sheet/sheet';
import { SnippetCompute } from '../snippet-compute/snippet-compute'; // Though not directly used, it's part of the Snippet union type for @Output

/**
 * The SnippetText component allows users to input and display multi-line text.
 * It implements the Snippet interface and can generate a Taylored XML block for its content.
 */
@Component({
  selector: 'app-snippet-text',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TextFieldModule],
  templateUrl: './snippet-text.html',
  styleUrl: './snippet-text.sass'
})
export class SnippetText implements Snippet {
  /**
   * The type of the snippet, fixed as 'text'.
   */
  type: 'text' = 'text';

  /**
   * The text content of the snippet.
   */
  @Input() value: string = '';
  /**
   * Unique identifier for the snippet.
   */
  @Input() id!: number;
  /**
   * Emits an event when the snippet's text content is updated.
   * The event payload can be either SnippetText or SnippetCompute, aligning with the `updateSnippet` output in the Sheet component.
   */
  @Output() updateSnippet = new EventEmitter<SnippetText | SnippetCompute>();


  /**
   * Generates an XMLDocument representing the snippet in Taylored format.
   * For text snippets, this includes the snippet ID and a 'text="true"' attribute.
   * @returns An XMLDocument for the text snippet.
   */
  getTayloredBlock(): XMLDocument {
    const xmlString = `<taylored number="${this.id}" text="true">${this.value}</taylored>`;
    return new DOMParser().parseFromString(xmlString, "text/xml");
  }

  /**
   * Emits an update event whenever the text content of the snippet changes.
   */
  onTextChange(): void {
    this.updateSnippet.emit(this);
  }
}
