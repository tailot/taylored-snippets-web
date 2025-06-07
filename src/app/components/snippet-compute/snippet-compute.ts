import { Component, Output, Input, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { Snippet } from '../sheet/sheet';
import { SnippetText } from '../snippet-text/snippet-text';
import { RunnerService } from 'src/app/services/runner.service';
import { Subscription } from 'rxjs';

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
export class SnippetCompute implements Snippet, OnInit, OnDestroy {
  type: 'compute' = 'compute';
  isPlayButtonDisabled: boolean = true;

  private outputSubscription!: Subscription;
  private errorSubscription!: Subscription;

  constructor(private runnerService: RunnerService) {}
  
  @Input() output: string = ''; // Initialize output
  @Input() value: string = '';
  @Input() id!: number;
  @Output() updateSnippet = new EventEmitter<SnippetText | SnippetCompute>();

  ngOnInit(): void {
    // Proactively attempt to provision a runner.
    // We don't await this because ngOnInit should not be async.
    // Errors are logged; tayloredRun will handle provisioning if this fails.
    this.runnerService.provisionRunner().catch(err => {
      console.error('Initial runner provisioning failed:', err);
    });

    this.outputSubscription = this.runnerService.listenForRunnerOutput().subscribe(data => {
      if (data && typeof data.output === 'string') {
        this.output = data.output;
      } else {
        this.output = JSON.stringify(data);
      }
    });

    this.errorSubscription = this.runnerService.listenForRunnerError().subscribe(error => {
      if (error && typeof error.error === 'string') {
        this.output = "Error: " + error.error;
      } else {
        this.output = "Error: " + JSON.stringify(error);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.outputSubscription) {
      this.outputSubscription.unsubscribe();
    }
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }

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

  async tayloredRun(): Promise<void> {
    this.output = ''; // Clear previous output/errors
    await this.runnerService.provisionRunner();

    if (!this.runnerService.runnerScript) {
      this.output = "Error: Could not provision runner.";
      // Optionally, re-enable the play button or provide other feedback
      return;
    }

    const xmlData = this.getTayloredBlock().outerHTML;
    this.runnerService.sendSnippetToRunner(xmlData);

    // Check if the message was likely sent.
    // sendSnippetToRunner logs if the socket isn't connected,
    // but we also want to update the UI.
    if (!this.runnerService.socket || this.runnerService.socket.readyState !== WebSocket.OPEN) {
      this.output = "Error: Runner not connected. Please try again.";
    }
  }
}
