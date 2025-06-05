import { Component, Output, Input, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Snippet } from '../sheet/sheet';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './snippet-compute.html',
  styleUrl: './snippet-compute.sass'
})
export class SnippetCompute implements Snippet {
  type: 'compute' = 'compute';
  snippetCode: string = '';
  isPlayButtonDisabled: boolean = true;

  @Input() id!: number;
  @Output() empty = new EventEmitter<number>();

  onSnippetChange(): void {
    this.isPlayButtonDisabled = true;

    if (!this.snippetCode) {
      return;
    }

    // Normalize escaped newlines that might come from test inputs or other sources
    const processedCode = this.snippetCode.replace(/\\n/g, '\n');
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
            // A script is runnable if it has a valid shebang on the first line
            // AND there is something after that first line (even an empty line from a trailing newline).
            if (lines.length > 1) {
              this.isPlayButtonDisabled = false;
            }
          }
        }
      }
    }
  }
  onTextChange(): void {
    if (this.snippetCode.trim() === '') {
      console.log('Snippet is empty, emitting id:', this.id);
      this.isPlayButtonDisabled = true;
      this.empty.emit(this.id);
    }
  }
}
