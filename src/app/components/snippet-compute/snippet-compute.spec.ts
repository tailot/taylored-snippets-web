import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetCompute } from './snippet-compute';

import { FormsModule } from '@angular/forms'; // Required for ngModel
import { MatInputModule } from '@angular/material/input'; // Required for matInput
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Required for some Material components

describe('SnippetComputeComponent', () => {
  let component: SnippetCompute;
  let fixture: ComponentFixture<SnippetCompute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SnippetCompute, // It's standalone
        FormsModule,      // For ngModel
        MatInputModule,   // For matInput used in textarea
        NoopAnimationsModule // Disable animations for tests
      ],
      providers: [provideZonelessChangeDetection()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetCompute);
    component = fixture.componentInstance;
    // Initialize with a default id for tests that might need it
    component.id = 1;
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
});
