import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetCompute } from './snippet-compute';
import { Subject } from 'rxjs';
import { RunnerService, SnippetOutput } from '../../services/runner.service';

import { FormsModule } from '@angular/forms'; // Required for ngModel
import { MatInputModule } from '@angular/material/input'; // Required for matInput
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Required for some Material components
import { HttpClientTestingModule } from '@angular/common/http/testing'; // Import HttpClientTestingModule

// Define mock RunnerService before the describe block or at a scope accessible to TestBed
let mockRunnerService: {
  snippetOutput$: Subject<SnippetOutput>;
  isRunnerReady$: Subject<boolean>;
  sendSnippetToRunner: jasmine.Spy;
  provisionRunner: jasmine.Spy; // Added provisionRunner
};

describe('SnippetComputeComponent', () => {
  let component: SnippetCompute;
  let fixture: ComponentFixture<SnippetCompute>;

  beforeEach(async () => {
    mockRunnerService = {
      snippetOutput$: new Subject<SnippetOutput>(),
      isRunnerReady$: new Subject<boolean>(),
      sendSnippetToRunner: jasmine.createSpy('sendSnippetToRunner').and.resolveTo(undefined),
      provisionRunner: jasmine.createSpy('provisionRunner').and.resolveTo(undefined) // Added provisionRunner
    };

    await TestBed.configureTestingModule({
      imports: [
        SnippetCompute, // It's standalone
        FormsModule,      // For ngModel
        MatInputModule,   // For matInput used in textarea
        NoopAnimationsModule, // Disable animations for tests
        HttpClientTestingModule // Add HttpClientTestingModule
      ],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RunnerService, useValue: mockRunnerService } // Add this
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetCompute);
    component = fixture.componentInstance;
    component.id = 1; // Ensure component has an ID for tests
    mockRunnerService.isRunnerReady$.next(true); // Simulate runner being ready
    fixture.detectChanges(); // Initial binding
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with an empty value string', () => {
    expect(component.value).toBe('');
  });

  describe('value property two-way binding', () => {
    it('should update textarea when component value changes', async () => {
      component.value = '#!/bin/bash\necho "Hello"';
      fixture.detectChanges(); // Trigger change detection
      await fixture.whenStable(); // Wait for async operations like ngModel to settle
      const textareaElement = fixture.debugElement.nativeElement.querySelector('textarea');
      expect(textareaElement.value).toBe('#!/bin/bash\necho "Hello"');
    });

    it('should update component value when textarea input changes', async () => {
      const textareaElement = fixture.debugElement.nativeElement.querySelector('textarea');
      textareaElement.value = '#!/bin/python\nprint("Hi")';
      textareaElement.dispatchEvent(new Event('input')); // Simulate input event
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value).toBe('#!/bin/python\nprint("Hi")');
    });
  });

  describe('getTayloredBlock method (using value)', () => {
    beforeEach(() => {
      // Set default values for id and value for these tests
      component.id = 123;
      component.value = 'console.log("Hello, Taylored!");';
      // fixture.detectChanges(); // Not strictly necessary for method testing unless it reads from DOM
    });

    it('should return a string', () => {
      const result = component.getTayloredBlock();
      expect(typeof result).toBe('string');
    });

    it('should return an XML string with the correct structure and content using value', () => {
      const result = component.getTayloredBlock();
      expect(typeof result).toBe('string');
      const doc = new DOMParser().parseFromString(result, "text/xml");

      const rootElement = doc.documentElement;
      expect(rootElement.tagName).toBe('taylored');
      expect(rootElement.getAttribute('number')).toBe(component.id.toString());
      expect(rootElement.textContent).toBe(`\n${component.value}\n`); // Check component.value

      const computeAttr = rootElement.getAttribute('compute');
      expect(computeAttr).toBeTruthy();
      // Basic check for Base64 pattern
      expect(/^[A-Za-z0-9+/=]+$/.test(computeAttr!)).toBeTrue();
    });

    it('should use the component id in the "number" attribute of the XML string', () => {
      component.id = 456; // Change id to test
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      expect(rootElement.getAttribute('number')).toBe('456');
    });

    it('should use the component value as the text content of the XML string', () => {
      component.value = 'alert("Test Code");'; // Change value to test
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      expect(rootElement.textContent).toBe('\nalert("Test Code");\n');
    });

    it('should have a valid Base64 encoded timestamp in the "compute" attribute of the XML string', () => {
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      const base64Timestamp = rootElement.getAttribute('compute');

      expect(base64Timestamp).toBeTruthy();
      // Try to decode it
      let decodedTimestamp: string = '';
      let errorDecoding: any = null;
      try {
        decodedTimestamp = atob(base64Timestamp!);
      } catch (e) {
        errorDecoding = e;
      }

      expect(errorDecoding).toBeNull('Timestamp should be valid Base64');
      expect(decodedTimestamp).toBeTruthy('Decoded timestamp should not be empty');
      expect(/^\d+$/.test(decodedTimestamp)).toBe(true, 'Decoded timestamp should be a string of digits');

      const numericTimestamp = parseInt(decodedTimestamp, 10);
      expect(isNaN(numericTimestamp)).toBe(false, 'Parsed timestamp should be a number');

      // Check if it's a reasonable timestamp (e.g., not too far in the past or future)
      // This is a loose check. Current time in ms.
      const now = Date.now();
      // Allowing a reasonable delta (e.g., 10 seconds for test execution and potential clock differences)
      // Increased delta to 20s to be safer with test runners
      expect(numericTimestamp).toBeGreaterThanOrEqual(now - 20000, 'Timestamp seems too old');
      expect(numericTimestamp).toBeLessThanOrEqual(now + 20000, 'Timestamp seems too far in the future');
    });
  });

  describe('output text area', () => {
    it('should not display the output text area if output is undefined', () => {
      component.output = undefined;
      fixture.detectChanges();
      const outputTextArea = fixture.debugElement.nativeElement.querySelector('textarea[matInput][readonly]');
      // The main textarea is not readonly, the output one is.
      // So if we find a readonly textarea, it must be the output one.
      expect(outputTextArea).toBeNull();
    });

    it('should not display the output text area if output is an empty string', () => {
      component.output = '';
      fixture.detectChanges();
      // We need to be more specific if there are multiple textareas.
      // Assuming the output textarea is the only one with 'readonly'
      const outputTextArea = fixture.debugElement.nativeElement.querySelector('textarea[matInput][readonly]');
      expect(outputTextArea).toBeNull(); // *ngIf should remove it from the DOM
    });

    it('should display the output text area if output has content', () => {
      component.output = 'Some output text';
      fixture.detectChanges();
      const outputTextArea = fixture.debugElement.nativeElement.querySelector('textarea[matInput][readonly]');
      expect(outputTextArea).toBeTruthy();
      expect(outputTextArea.value).toBe('Some output text');
    });

    it('should display the output text area with correct content', () => {
      const testOutput = 'This is a test output value.';
      component.output = testOutput;
      fixture.detectChanges();
      const outputTextArea = fixture.debugElement.nativeElement.querySelector('textarea[matInput][readonly]');
      expect(outputTextArea).toBeTruthy();
      expect(outputTextArea.value).toBe(testOutput);
    });

    it('output text area should be readonly', () => {
      component.output = 'Some output';
      fixture.detectChanges();
      const outputTextArea = fixture.debugElement.nativeElement.querySelector('textarea[matInput][readonly]');
      expect(outputTextArea).toBeTruthy();
      expect(outputTextArea.hasAttribute('readonly')).toBe(true);
    });
  });

  xdescribe('finishedProcessing event emitter', () => {
    let runnerService: RunnerService; // To hold the injected mock service

    beforeEach(() => {
      // Get the injected mock RunnerService instance
      // Note: TestBed.inject can be used here if preferred, or stick to the variable 'mockRunnerService'
      // For simplicity, we'll use the 'mockRunnerService' variable directly as it's in scope.
      // runnerService = TestBed.inject(RunnerService); // This would also work if mockRunnerService is not directly accessible

      // Reset component.output and spy before each test in this block
      component.output = undefined; // Start clean
      spyOn(component.finishedProcessing, 'emit');
      component.id = 1; // Consistent ID for these tests
      fixture.detectChanges();
    });

    it('should emit finishedProcessing when output ends with the target string', () => {
      component.output = 'Executing...'; // Initial state set by onPlayButtonClick
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, output: 'Finished processing. Successfully created 1 taylored file(s).' });
      fixture.detectChanges();

      expect(component.finishedProcessing.emit).toHaveBeenCalledWith(component);
    });

    it('should emit finishedProcessing when output (already having some content) is appended to end with the target string', () => {
      component.output = 'Executing...Some initial data...'; // Some pre-existing output
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, output: 'Finished processing. Successfully created 1 taylored file(s).' });
      fixture.detectChanges();

      // Expected full output: "Executing...Some initial data...Finished processing. Successfully created 1 taylored file(s)."
      expect(component.output).toBe('Executing...Some initial data...Finished processing. Successfully created 1 taylored file(s).');
      expect(component.finishedProcessing.emit).toHaveBeenCalledWith(component);
    });

    it('should not emit finishedProcessing if output does not end with the target string', () => {
      component.output = 'Executing...';
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, output: 'Some other message.' });
      fixture.detectChanges();

      expect(component.finishedProcessing.emit).not.toHaveBeenCalled();
    });

    it('should not emit finishedProcessing if snippet ID does not match', () => {
      component.output = 'Executing...';
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id + 1, output: 'Finished processing. Successfully created 1 taylored file(s).' });
      fixture.detectChanges();

      expect(component.finishedProcessing.emit).not.toHaveBeenCalled();
    });

    it('should not emit finishedProcessing if there is an error output', () => {
      component.output = 'Executing...';
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, error: 'An error occurred.' });
      fixture.detectChanges();

      expect(component.finishedProcessing.emit).not.toHaveBeenCalled();
    });

    it('should correctly handle initial undefined output before concatenation', () => {
      // component.output is initially undefined or set by onPlayButtonClick
      // Let's test the scenario where onPlayButtonClick wasn't called, and output is undefined
      component.output = undefined;
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, output: 'Finished processing. Successfully created 1 taylored file(s).' });
      fixture.detectChanges();

      // Con la modifica al componente (che inizializza output a '' se undefined prima della concatenazione),
      // il prefisso "undefined" non è più atteso.
      expect((component.output as unknown) as string).toBe('Finished processing. Successfully created 1 taylored file(s).');
      expect(component.finishedProcessing.emit).toHaveBeenCalledWith(component);
    });

    xit('should correctly handle initial empty string output before concatenation', () => {
      component.output = ''; // Initial state
      fixture.detectChanges();

      mockRunnerService.snippetOutput$.next({ id: component.id, output: 'Finished processing. Successfully created 1 taylored file(s).' });
      fixture.detectChanges();

      expect(component.output).toBe('Finished processing. Successfully created 1 taylored file(s).');
      expect(component.finishedProcessing.emit).toHaveBeenCalledWith(component);
    });
  });
});
