import { Component, Output, Input, OnInit, OnDestroy, ChangeDetectorRef, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { Snippet } from '../sheet/sheet';
import { SnippetText } from '../snippet-text/snippet-text';
import { RunnerService, SnippetOutput } from '../../services/runner.service';

export const VALID_INTERPRETERS = [
  'awk',
  'bash',
  'expect',
  'gawk',
  'java',
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
export class SnippetCompute implements Snippet, OnInit, OnDestroy {
  type: 'compute' = 'compute';
  isPlayButtonDisabled: boolean = true; // Will be updated based on isRunnerReady and snippet content validity
  isRunnerReady = false;
  private subscriptions = new Subscription();

  constructor(private runnerService: RunnerService, private cdr: ChangeDetectorRef) {}
  
  @Input() output?: string;
  @Input() value: string = '';
  @Input() id!: number;
  @Output() updateSnippet = new EventEmitter<SnippetText | SnippetCompute>();
  @Output() finishedProcessing = new EventEmitter<SnippetCompute>();

  getTayloredBlock(): XMLDocument {
    const timestamp = Date.now().toString();
    const encodedTimestamp = btoa(timestamp);
    const xmlString = `<taylored number="${this.id}" compute="${encodedTimestamp}">\n${this.value}\n</taylored>`;
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

  async onPlayButtonClick(): Promise<void> {
    this.output = 'Executing...'; // Provide immediate feedback
    const xmlDoc = this.getTayloredBlock();
    const serializer = new XMLSerializer();
    // Using xmlDoc.documentElement to serialize just the <taylored> element and its content
    const xmlString = serializer.serializeToString(xmlDoc.documentElement);
    await this.runnerService.sendSnippetToRunner(xmlString);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.runnerService.isRunnerReady$.subscribe(isReady => {
        this.isRunnerReady = isReady;
        // Future: this.updatePlayButtonState(); (or similar if combined with snippet validity)
      })
    );

    this.subscriptions.add(
      this.runnerService.snippetOutput$.subscribe((result: SnippetOutput) => {
        if (result.id === this.id) {
          if (result.error) {
            this.output = `Error: ${result.error}`;
          } else if (result.output) {
            // Initialize output as empty string if undefined, then concatenate
            this.output = (this.output || '') + result.output;
            this.cdr.detectChanges();
            if (this.output?.includes('Finished processing. Successfully created 1 taylored file(s).')) {
              this.finishedProcessing.emit(this);
            }
          }
          // If neither error nor output is present for this ID, this.output remains unchanged.
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
