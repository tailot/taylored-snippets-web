import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetCompute } from './snippet-compute';
import { RunnerService } from 'src/app/services/runner.service';
import { of, EMPTY, Subject } from 'rxjs';

import { FormsModule } from '@angular/forms'; // Required for ngModel
import { MatInputModule } from '@angular/material/input'; // Required for matInput
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Required for some Material components

describe('SnippetComputeComponent', () => {
  let component: SnippetCompute;
  let fixture: ComponentFixture<SnippetCompute>;
  let mockRunnerService: jasmine.SpyObj<RunnerService>;

  beforeEach(async () => {
    mockRunnerService = jasmine.createSpyObj('RunnerService', [
      'provisionRunner',
      'sendSnippetToRunner',
      'listenForRunnerOutput',
      'listenForRunnerError'
    ]);

    await TestBed.configureTestingModule({
      imports: [
        SnippetCompute, // It's standalone
        FormsModule,      // For ngModel
        MatInputModule,   // For matInput used in textarea
        NoopAnimationsModule // Disable animations for tests
      ],
      providers: [
        provideZonelessChangeDetection(),
        { provide: RunnerService, useValue: mockRunnerService }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetCompute);
    component = fixture.componentInstance;
    component.id = 1; // Initialize with a default id

    // Default mock implementations BEFORE ngOnInit is triggered by detectChanges
    // Note: component.output is initialized to '' in the component itself.
    mockRunnerService.provisionRunner.and.returnValue(Promise.resolve('mockEndpoint'));
    mockRunnerService.listenForRunnerOutput.and.returnValue(EMPTY);
    mockRunnerService.listenForRunnerError.and.returnValue(EMPTY);
    mockRunnerService.sendSnippetToRunner.and.stub();

    fixture.detectChanges(); // Initial binding and ngOnInit call
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

  describe('onSnippetChange method and isPlayButtonDisabled state (using value)', () => {
    beforeEach(() => {
      // Reset value before each test in this block
      component.value = '';
      component.isPlayButtonDisabled = true; // Default state
      fixture.detectChanges(); // To apply initial bindings if any
    });

    // Valid Snippets (isPlayButtonDisabled should be false)
    it('should enable play for #!/bin/bash\\n echo "Hello"', () => {
      component.value = '#!/bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/env python3\\nprint("world")', () => {
      component.value = '#!/usr/bin/env python3\\nprint("world")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!node\\nconsole.log("test")', () => {
      component.value = '#!node\\nconsole.log("test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/perl\\n#comment', () => {
      component.value = '#!/usr/bin/perl\\n#comment';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/bin/sh\\nls', () => {
      component.value = '#!/bin/sh\\nls';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/Rscript\\nprint(1+1)', () => {
      component.value = '#!/usr/bin/Rscript\\nprint(1+1)';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/env lua\\nprint("lua")', () => {
      component.value = '#!/usr/bin/env lua\\nprint("lua")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    // Test case 8: Based on current regex, this will be disabled.
    it('should disable play for #!/usr/bin/awk -f\\nBEGIN { print "awk" } (due to flags in shebang)', () => {
      component.value = '#!/usr/bin/awk -f\\nBEGIN { print "awk" }';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    // Invalid Snippets (isPlayButtonDisabled should be true)
    it('should disable play for #!/bin/unsupported-interpreter\\n echo "Hello"', () => {
      component.value = '#!/bin/unsupported-interpreter\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #/bin/bash\\n echo "Hello" (Missing !)', () => {
      component.value = '#/bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #! /bin/bash\\n echo "Hello" (Space after #!)', () => {
      component.value = '#! /bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/bin/bash (Missing newline after shebang)', () => {
      component.value = '#!/bin/bash';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env python3 (Missing newline after shebang)', () => {
      component.value = '#!/usr/bin/env python3';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!node (Missing newline after shebang)', () => {
      component.value = '#!node';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for echo "No shebang"', () => {
      component.value = 'echo "No shebang"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for "" (Empty snippet)', () => {
      component.value = '';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env unsupported-script\\nprint("test")', () => {
      component.value = '#!/usr/bin/env unsupported-script\\nprint("test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env\\npython3 (Interpreter on wrong line)', () => {
      component.value = '#!/usr/bin/env\\npython3';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!bash echo "no newline" (No newline after interpreter on shebang line)', () => {
      component.value = '#!bash echo "no newline"'; // This makes the firstLine `#!bash echo "no newline"`
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env R\\nprint("R test") (R not in VALID_INTERPRETERS, Rscript is)', () => {
      component.value = '#!/usr/bin/env R\\nprint("R test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });
  });

  describe('getTayloredBlock method (using value)', () => {
    beforeEach(() => {
      // Set default values for id and value for these tests
      component.id = 123;
      component.value = 'console.log("Hello, Taylored!");';
      // fixture.detectChanges(); // Not strictly necessary for method testing unless it reads from DOM
    });

    it('should return an XMLDocument', () => {
      const result = component.getTayloredBlock();
      expect(result).toBeInstanceOf(XMLDocument);
    });

    it('should return an XMLDocument with the correct structure and content using value', () => {
      const result = component.getTayloredBlock();
      expect(result).toBeInstanceOf(XMLDocument);

      const rootElement = result.documentElement;
      expect(rootElement.tagName).toBe('taylored');
      expect(rootElement.getAttribute('number')).toBe(component.id.toString());
      expect(rootElement.textContent).toBe(component.value); // Check component.value

      const computeAttr = rootElement.getAttribute('compute');
      expect(computeAttr).toBeTruthy();
      // Basic check for Base64 pattern
      expect(/^[A-Za-z0-9+/=]+$/.test(computeAttr!)).toBeTrue();
    });

    it('should use the component id in the "number" attribute of the XMLDocument', () => {
      component.id = 456; // Change id to test
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
      expect(rootElement.getAttribute('number')).toBe('456');
    });

    it('should use the component value as the text content of the XMLDocument', () => {
      component.value = 'alert("Test Code");'; // Change value to test
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
      expect(rootElement.textContent).toBe('alert("Test Code");');
    });

    it('should have a valid Base64 encoded timestamp in the "compute" attribute of the XMLDocument', () => {
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
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

  // New test suites
  describe('ngOnInit interactions', () => {
    it('should call provisionRunner on init', () => {
      expect(mockRunnerService.provisionRunner).toHaveBeenCalled();
    });

    it('should subscribe to listenForRunnerOutput on init', () => {
      expect(mockRunnerService.listenForRunnerOutput).toHaveBeenCalled();
    });

    it('should subscribe to listenForRunnerError on init', () => {
      expect(mockRunnerService.listenForRunnerError).toHaveBeenCalled();
    });

    it('should initialize output to an empty string (already handled by component init, verify here)', () => {
      // component.output is initialized to '' in its declaration.
      // ngOnInit also subscribes, but default EMPTY observable won't emit.
      expect(component.output).toBe('');
    });
  });

  describe('tayloredRun method', () => {
    beforeEach(() => {
      // Reset spies and component state before each test in this block
      mockRunnerService.provisionRunner.calls.reset();
      mockRunnerService.sendSnippetToRunner.calls.reset();
      component.output = ''; // Clear output
      // Ensure a valid snippet that would enable the play button
      component.value = '#!/bin/bash\necho "test"';
      component.onSnippetChange(); // This should set isPlayButtonDisabled to false
      fixture.detectChanges();
    });

    it('should clear previous output when called', async () => {
      component.output = 'previous message';
      await component.tayloredRun();
      // Expectation is that the first action in tayloredRun is to clear output.
      // If provisionRunner fails and sets an error, this test might need adjustment
      // or to spy on that first line. For now, assuming it gets past the clear.
      // The actual check for clearing is implicitly part of other tests ensuring specific outputs.
      // Explicit test for clearing:
      mockRunnerService.provisionRunner.and.returnValue(Promise.resolve(null)); // cause it to fail after clearing
      await component.tayloredRun();
      expect(component.output).not.toBe('previous message'); // It should be the error message or empty if error logic changes
    });

    it('should call provisionRunner', async () => {
      await component.tayloredRun();
      expect(mockRunnerService.provisionRunner).toHaveBeenCalled();
    });

    it('should call getTayloredBlock and sendSnippetToRunner on successful provisioning', async () => {
      mockRunnerService.provisionRunner.and.returnValue(Promise.resolve('mockEndpoint'));
      mockRunnerService.runnerScript = 'mockEndpoint'; // Simulate successful provisioning
      spyOn(component, 'getTayloredBlock').and.callThrough();

      await component.tayloredRun();

      expect(component.getTayloredBlock).toHaveBeenCalled();
      expect(mockRunnerService.sendSnippetToRunner).toHaveBeenCalled();
      const expectedXml = component.getTayloredBlock().outerHTML; // Call it again to get what it would have been
      expect(mockRunnerService.sendSnippetToRunner).toHaveBeenCalledWith(expectedXml);
    });

    it('should set output to error if provisionRunner fails (returns null)', async () => {
      mockRunnerService.provisionRunner.and.returnValue(Promise.resolve(null));
      mockRunnerService.runnerScript = undefined; // Ensure runnerScript is not set

      await component.tayloredRun();

      expect(component.output).toBe('Error: Could not provision runner.');
      expect(mockRunnerService.sendSnippetToRunner).not.toHaveBeenCalled();
    });

    it('should set output to error if provisionRunner fails (rejects)', async () => {
      mockRunnerService.provisionRunner.and.returnValue(Promise.reject(new Error('Provisioning error')));
      mockRunnerService.runnerScript = undefined; // Ensure runnerScript is not set

      await component.tayloredRun();

      // The current implementation of provisionRunner().catch in ngOnInit logs,
      // but tayloredRun itself awaits provisionRunner. If that promise rejects AND
      // runnerScript is not set, it should show "Could not provision runner."
      // If runnerScript *was* set from a previous successful call, this might behave differently.
      // For this test, ensure runnerScript is undefined to simulate fresh failure.
      expect(component.output).toBe('Error: Could not provision runner.');
      expect(mockRunnerService.sendSnippetToRunner).not.toHaveBeenCalled();
    });

    it('should set output to error if runner is not connected when sending', async () => {
      mockRunnerService.provisionRunner.and.returnValue(Promise.resolve('mockEndpoint'));
      mockRunnerService.runnerScript = 'mockEndpoint';
      // Simulate WebSocket not being open
      mockRunnerService.socket = { readyState: WebSocket.CLOSED } as WebSocket;

      await component.tayloredRun();

      expect(mockRunnerService.sendSnippetToRunner).toHaveBeenCalled(); // It will still attempt to send
      expect(component.output).toBe('Error: Runner not connected. Please try again.');
    });
  });

  describe('RunnerService listeners', () => {
    let outputSubject: Subject<{ output: string } | any>;
    let errorSubject: Subject<{ error: string } | any>;

    beforeEach(() => {
      outputSubject = new Subject<{ output: string } | any>(); // Note: Subject was imported at top-level
      errorSubject = new Subject<{ error: string } | any>();   // Note: Subject was imported at top-level
      mockRunnerService.listenForRunnerOutput.and.returnValue(outputSubject.asObservable());
      mockRunnerService.listenForRunnerError.and.returnValue(errorSubject.asObservable());

      // Re-run ngOnInit essentially by creating a new component or re-subscribing.
      // For simplicity, we directly call ngOnInit if it's safe, or re-create.
      // Here, we'll re-initialize the subscriptions manually for these tests.
      // Note: This is a bit of a workaround. Ideally, TestBed would handle this,
      // but direct subject manipulation after initial detectChanges requires care.
      // A cleaner way might be to re-createComponent for these specific listener tests.
      // However, let's try direct subscription for now if ngOnInit handles re-subscription well.
      // SnippetCompute's ngOnInit doesn't protect against multiple subscriptions, so this is fine.
      component.ngOnInit();
      fixture.detectChanges();
    });

    it('should update output when listenForRunnerOutput emits data with output property', () => {
      const testData = { output: 'Runner test output' };
      outputSubject.next(testData);
      fixture.detectChanges();
      expect(component.output).toBe('Runner test output');
    });

    it('should update output with stringified data if output property is missing', () => {
      const testData = { message: 'Some other data' };
      outputSubject.next(testData);
      fixture.detectChanges();
      expect(component.output).toBe(JSON.stringify(testData));
    });

    it('should update output with stringified data if data is not an object (e.g. string)', () => {
      const testData = 'Raw string output';
      outputSubject.next(testData); // listenForRunnerOutput expects an object, but testing robustness
      fixture.detectChanges();
      expect(component.output).toBe(JSON.stringify(testData)); // Current implementation will stringify
    });

    it('should update output with error message when listenForRunnerError emits an error with error property', () => {
      const testError = { error: 'Runner error occurred' };
      errorSubject.next(testError);
      fixture.detectChanges();
      expect(component.output).toBe('Error: Runner error occurred');
    });

    it('should update output with stringified error if error property is missing', () => {
      const testError = { details: 'Some other error info' };
      errorSubject.next(testError);
      fixture.detectChanges();
      expect(component.output).toBe('Error: ' + JSON.stringify(testError));
    });

    it('should update output with stringified error if error is not an object (e.g. string)', () => {
      const testError = 'Raw error string';
      errorSubject.next(testError); // listenForRunnerError expects an object
      fixture.detectChanges();
      expect(component.output).toBe('Error: ' + JSON.stringify(testError)); // Current implementation
    });
  });

  describe('ngOnDestroy', () => {
    it('should call unsubscribe on outputSubscription if it exists', () => {
      // outputSubscription is assigned in ngOnInit.
      // We need to spy on its unsubscribe method.
      // Since EMPTY completes immediately, its subscription might be auto-cleaned.
      // Let's use a Subject that doesn't complete to ensure subscription exists.
      const outputSub = new Subject<any>();
      mockRunnerService.listenForRunnerOutput.and.returnValue(outputSub.asObservable());
      // component.ngOnInit(); // Call ngOnInit again to re-subscribe with the new subject
      // Need to access the actual subscription object created inside component.
      // This requires outputSubscription to be non-private or use a spy.
      // For simplicity, let's assume the subscriptions are stored as component properties
      // (which they are: this.outputSubscription, this.errorSubscription)

      // Re-initialize component to ensure subscriptions are fresh with non-completing observables
      // This is getting complicated due to beforeEach setting up EMPTY.
      // A focused beforeEach for this describe block might be better.
      // For now, let's spy on the component's subscription's unsubscribe method.

      // Access the subscription made in the main beforeEach (which used EMPTY)
      // This test might be tricky if EMPTY's subscription is already closed.
      // A better approach for this specific test:
      const mockOutputSubscription = jasmine.createSpyObj('Subscription', ['unsubscribe']);
      const mockErrorSubscription = jasmine.createSpyObj('Subscription', ['unsubscribe']);

      (component as any).outputSubscription = mockOutputSubscription;
      (component as any).errorSubscription = mockErrorSubscription;

      component.ngOnDestroy();

      expect(mockOutputSubscription.unsubscribe).toHaveBeenCalled();
      expect(mockErrorSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should not throw if subscriptions do not exist (though current code always creates them)', () => {
       // Set them to undefined to simulate a state where they might not exist
      (component as any).outputSubscription = undefined;
      (component as any).errorSubscription = undefined;

      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
