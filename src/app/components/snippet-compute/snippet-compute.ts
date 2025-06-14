import { Component, Output, Input, OnInit, OnDestroy, ChangeDetectorRef, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { Snippet } from '../sheet/sheet';
import { SnippetText } from '../snippet-text/snippet-text';
/**
 * @fileoverview Defines the SnippetCompute component, which represents an executable code snippet.
 * It handles code input, execution via RunnerService, and output display.
 */
import { RunnerService, SnippetOutput } from '../../services/runner.service';


/**
 * The SnippetCompute component allows users to input and execute code.
 * It validates the interpreter, sends the code to the RunnerService, and displays the output or errors.
 */
@Component({
  selector: 'app-snippet-compute',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TextFieldModule, MatButtonModule],
  templateUrl: './snippet-compute.html',
  styleUrl: './snippet-compute.sass'
})
export class SnippetCompute implements Snippet, OnInit, OnDestroy {
  /**
   * The type of the snippet, fixed as 'compute'.
   */
  type: 'compute' = 'compute';
  /**
   * Flag to disable the play button, based on runner readiness and snippet validity.
   */
  isPlayButtonDisabled: boolean = true;
  /**
   * Flag indicating if the runner service is ready to execute code.
   */
  isRunnerReady = false;
  /**
   * Manages subscriptions to observables.
   */
  private subscriptions = new Subscription();

  /**
   * Constructs the SnippetCompute component.
   * @param runnerService Service to execute the snippet's code.
   * @param cdr Change detector reference for updating the view.
   */
  constructor(private runnerService: RunnerService, private cdr: ChangeDetectorRef) {}
  
  /**
   * The output received from executing the snippet.
   */
  @Input() output?: string;
  /**
   * The code content of the snippet.
   */
  @Input() value: string = '';
  /**
   * Unique identifier for the snippet.
   */
  @Input() id!: number;
  /**
   * Emits an event when the snippet's content or state is updated.
   */
  @Output() updateSnippet = new EventEmitter<SnippetText | SnippetCompute>();
  /**
   * Emits an event when the snippet has finished processing, typically after successful execution.
   */
  @Output() finishedProcessing = new EventEmitter<SnippetCompute>();

  /**
   * Generates an XMLDocument representing the snippet in Taylored format.
   * This format includes the snippet ID and a base64 encoded timestamp for uniqueness.
   * @returns An String for the compute snippet.
   */
  getTayloredBlock(): string {
    const timestamp = Date.now().toString();
    const encodedTimestamp = btoa(timestamp);
    const xmlString = `<taylored number="${this.id}" compute="${encodedTimestamp}">\n${this.value}\n</taylored>`;
    return xmlString;
  }

  /**
   * Emits an update event whenever the text content of the snippet changes.
   */
  onTextChange(): void {
    this.updateSnippet.emit(this);
  }

  /**
   * Handles the play button click event.
   * It sets an "Executing..." message, generates the Taylored XML, and sends it to the RunnerService.
   */
  async onPlayButtonClick(): Promise<void> {
    this.output = 'Executing...'; // Provide immediate feedback
    const xmlDoc = this.getTayloredBlock();
    await this.runnerService.sendSnippetToRunner(xmlDoc);
  }

  /**
   * Initializes the component by subscribing to runner readiness and snippet output events.
   * Updates runner readiness state and handles incoming snippet results (output or errors).
   */
  ngOnInit(): void {
    this.subscriptions.add(
      this.runnerService.isRunnerReady$.subscribe(isReady => {
        this.isRunnerReady = isReady;
        this.isPlayButtonDisabled = !isReady; // Enable button if runner is ready, disable otherwise
        this.cdr.detectChanges(); // Ensure the view updates
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

              const snapshotInstance = new SnippetCompute(this.runnerService, this.cdr);
              snapshotInstance.id = this.id;
              snapshotInstance.value = this.value;
              snapshotInstance.output = this.output;

              this.finishedProcessing.emit(snapshotInstance);
            }
          }
          // If neither error nor output is present for this ID, this.output remains unchanged.
        }
      })
    );
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
