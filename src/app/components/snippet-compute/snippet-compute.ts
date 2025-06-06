import { Component, Output, Input, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { Snippet } from '../sheet/sheet';
import { SnippetText } from '../snippet-text/snippet-text';

export const VALID_INTERPRETERS = [
  'awk',
  'bash',
  'csh',
  'expect',
  'gawk',
  'groovy',
  'java',
  'ksh',
  'lua',
  'lua5.4',
  'node',
  'perl',
  'php',
  'python',
  'python3',
  'Rscript',
  'ruby',
  'sed',
  'sh',
  'tcl',
  'tcsh',
  'ts-node',
  'zsh',
];

@Component({
  selector: 'app-snippet-compute',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TextFieldModule, MatButtonModule],
  templateUrl: './snippet-compute.html',
  styleUrl: './snippet-compute.sass'
})
export class SnippetCompute implements Snippet {
  type: 'compute' = 'compute';
  isPlayButtonDisabled: boolean = true;
  
  @Input() output?: string;
  @Input() value: string = '';
  @Input() id!: number;
  @Output() updateSnippet = new EventEmitter<SnippetText | SnippetCompute>();

  getTayloredBlock(): XMLDocument {
    const timestamp = Date.now().toString();
    const encodedTimestamp = btoa(timestamp);
    const xmlString = `<taylored number="${this.id}" compute="${encodedTimestamp}">${this.value}</taylored>`;
    return new DOMParser().parseFromString(xmlString, "text/xml");
  }

  onSnippetChange(): void {
    this.isPlayButtonDisabled = true;

    if (!this.value) {
      return;
    }

    // Normalize escaped newlines that might come from test inputs or other sources
    const processedCode = this.value.replace(/\\n/g, '\n');
    const lines = processedCode.split('\n');

    // Shebang must be on the first line
    if (lines.length > 0) {
      const firstLine = lines[0].trimStart();
      if (firstLine.startsWith('#!')) {
        // Regex ensures interpreter is at the end of the firstLine
        const shebangMatch = firstLine.match(/^#!(?:\/(?:usr\/)?bin\/env\s+|\/(?:usr\/|usr\/local\/)?bin\/)?([a-zA-Z0-9._-]+)$/);

        if (shebangMatch && shebangMatch[1]) {
          const interpreter = shebangMatch[1];
          if (VALID_INTERPRETERS.includes(interpreter)) {
            if (lines.length > 1) {
              this.isPlayButtonDisabled = false;
            }
          }
        }
      }
    }
  }
  onTextChange(): void {
    this.updateSnippet.emit(this);
  }
}
