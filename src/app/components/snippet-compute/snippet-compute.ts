import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Good practice for standalone components
import { FormsModule } from '@angular/forms'; // Required for ngModel

export const VALID_INTERPRETERS = [
  'bash',
  'ksh',
  'zsh',
  'csh',
  'tcsh',
  'python3',
  'perl',
  'ruby',
  'node',
  'ts-node',
  'php',
  'java',
  'groovy',
  'lua5.4',
  'R',
  'gawk',
  'tcl',
  'expect',
];

@Component({
  selector: 'app-snippet-compute',
  standalone: true, // Ensure it is standalone
  imports: [CommonModule, FormsModule], // Add CommonModule and FormsModule
  templateUrl: './snippet-compute.html',
  styleUrl: './snippet-compute.sass'
})
export class SnippetCompute {
  snippetCode: string = '';
  isPlayButtonDisabled: boolean = true;

  onSnippetChange(): void {
    if (!this.snippetCode) {
      this.isPlayButtonDisabled = true;
      return;
    }

    const lines = this.snippetCode.split('\\n');
    const firstLine = lines[0];

    if (!firstLine.startsWith('#!')) {
      this.isPlayButtonDisabled = true;
      return;
    }

    // Extracts interpreter, optionally ignoring path like /bin/ or /usr/bin
    // e.g. #!/usr/bin/python3 -> python3
    // e.g. #!bash -> bash
    // The first line should strictly be the shebang and interpreter, nothing else.
    const shebangMatch = firstLine.match(/^#!(?:\/(?:usr\/)?bin\/)?([a-zA-Z0-9._-]+)$/);

    if (shebangMatch && shebangMatch[1]) {
      const interpreter = shebangMatch[1];
      // Check if the snippet has more than just the shebang line OR if the shebang line is the entire snippet code (e.g. "#!bash" is not enough, needs a newline)
      // However, snippetCode is the full content. If split by \n, firstLine is correct.
      // The requirement "and then a newline character" is implicitly handled if lines.length > 1 or if snippetCode ends with \n.
      // For a single line snippet like "#!bash", it's valid if it's intended to be executed as such.
      // The prompt example "#!/bin/bash\n" suggests the newline is significant.
      // If snippetCode is just "#!bash", then lines.length is 1.
      // If snippetCode is "#!bash\n", then lines will be ["#!bash", ""].
      // The problem seems to imply that the script itself must have a newline after the shebang.
      // This means `this.snippetCode` must contain a `\n` after the first line.

      const isValidInterpreter = VALID_INTERPRETERS.includes(interpreter);
      if (isValidInterpreter) {
        // Check if there's a newline after the first line, or if the first line is the only content and it doesn't end with \n.
        // A script is valid if it's `#!interpreter\n...` or `#!interpreter\n`
        // A script is not valid if it's just `#!interpreter`
        if (this.snippetCode.includes('\\n')) {
             this.isPlayButtonDisabled = false;
        } else {
            // If there's no newline at all in the snippet code, it means it's a single line like "#!bash"
            // This is considered invalid by the prompt's examples like "#!/bin/bash\n"
            this.isPlayButtonDisabled = true;
        }
      } else {
        this.isPlayButtonDisabled = true;
      }
    } else {
      this.isPlayButtonDisabled = true;
    }
  }
}
