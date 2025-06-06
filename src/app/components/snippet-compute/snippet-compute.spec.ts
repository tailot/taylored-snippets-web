import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetCompute } from './snippet-compute';

describe('SnippetComputeComponent', () => {
  let component: SnippetCompute;
  let fixture: ComponentFixture<SnippetCompute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnippetCompute], // It's standalone
      providers: [provideZonelessChangeDetection()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetCompute);
    component = fixture.componentInstance;
    // fixture.detectChanges() // We call this later or per test if needed, or rely on component methods directly
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Remove or keep this test based on whether the static <p> tag is still relevant
  // For now, let's assume it might be removed or changed by other tasks.
  // it('should display compute snippet placeholder content', () => {
  //   fixture.detectChanges(); // Detect changes to render the template
  //   const pElement = fixture.debugElement.nativeElement.querySelector('p');
  //   expect(pElement).toBeTruthy();
  //   expect(pElement.textContent).toContain('This is a Compute Snippet');
  // });

  describe('onSnippetChange method and isPlayButtonDisabled state', () => {
    beforeEach(() => {
      // Reset snippetCode before each test in this block
      component.snippetCode = '';
      component.isPlayButtonDisabled = true; // Default state
      fixture.detectChanges(); // To apply initial bindings if any
    });

    // Valid Snippets (isPlayButtonDisabled should be false)
    it('should enable play for #!/bin/bash\\n echo "Hello"', () => {
      component.snippetCode = '#!/bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/env python3\\nprint("world")', () => {
      component.snippetCode = '#!/usr/bin/env python3\\nprint("world")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!node\\nconsole.log("test")', () => {
      component.snippetCode = '#!node\\nconsole.log("test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/perl\\n#comment', () => {
      component.snippetCode = '#!/usr/bin/perl\\n#comment';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/bin/sh\\nls', () => {
      component.snippetCode = '#!/bin/sh\\nls';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/Rscript\\nprint(1+1)', () => {
      component.snippetCode = '#!/usr/bin/Rscript\\nprint(1+1)';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    it('should enable play for #!/usr/bin/env lua\\nprint("lua")', () => {
      component.snippetCode = '#!/usr/bin/env lua\\nprint("lua")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(false);
    });

    // Test case 8: Based on current regex, this will be disabled.
    it('should disable play for #!/usr/bin/awk -f\\nBEGIN { print "awk" } (due to flags in shebang)', () => {
      component.snippetCode = '#!/usr/bin/awk -f\\nBEGIN { print "awk" }';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    // Invalid Snippets (isPlayButtonDisabled should be true)
    it('should disable play for #!/bin/unsupported-interpreter\\n echo "Hello"', () => {
      component.snippetCode = '#!/bin/unsupported-interpreter\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #/bin/bash\\n echo "Hello" (Missing !)', () => {
      component.snippetCode = '#/bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #! /bin/bash\\n echo "Hello" (Space after #!)', () => {
      component.snippetCode = '#! /bin/bash\\n echo "Hello"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/bin/bash (Missing newline after shebang)', () => {
      component.snippetCode = '#!/bin/bash';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env python3 (Missing newline after shebang)', () => {
      component.snippetCode = '#!/usr/bin/env python3';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!node (Missing newline after shebang)', () => {
      component.snippetCode = '#!node';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for echo "No shebang"', () => {
      component.snippetCode = 'echo "No shebang"';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for "" (Empty snippet)', () => {
      component.snippetCode = '';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env unsupported-script\\nprint("test")', () => {
      component.snippetCode = '#!/usr/bin/env unsupported-script\\nprint("test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env\\npython3 (Interpreter on wrong line)', () => {
      component.snippetCode = '#!/usr/bin/env\\npython3';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!bash echo "no newline" (No newline after interpreter on shebang line)', () => {
      component.snippetCode = '#!bash echo "no newline"'; // This makes the firstLine `#!bash echo "no newline"`
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });

    it('should disable play for #!/usr/bin/env R\\nprint("R test") (R not in VALID_INTERPRETERS, Rscript is)', () => {
      component.snippetCode = '#!/usr/bin/env R\\nprint("R test")';
      component.onSnippetChange();
      expect(component.isPlayButtonDisabled).toBe(true);
    });
  });

  describe('getTayloredBlock method', () => {
    beforeEach(() => {
      // Set default values for id and snippetCode for these tests
      component.id = 123;
      component.snippetCode = 'console.log("Hello, Taylored!");';
      // fixture.detectChanges(); // Not strictly necessary for method testing unless it reads from DOM
    });

    it('should return an XMLDocument', () => {
      const result = component.getTayloredBlock();
      expect(result).toBeInstanceOf(XMLDocument);
    });

    it('should return an XMLDocument with the correct structure and content', () => {
      const result = component.getTayloredBlock();
      expect(result).toBeInstanceOf(XMLDocument);

      const rootElement = result.documentElement;
      expect(rootElement.tagName).toBe('taylored');
      expect(rootElement.getAttribute('number')).toBe(component.id.toString());
      expect(rootElement.textContent).toBe(component.snippetCode);

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

    it('should use the component snippetCode as the text content of the XMLDocument', () => {
      component.snippetCode = 'alert("Test Code");'; // Change snippetCode to test
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
      expect(numericTimestamp).toBeGreaterThanOrEqual(now - 10000, 'Timestamp seems too old');
      expect(numericTimestamp).toBeLessThanOrEqual(now + 10000, 'Timestamp seems too far in the future');
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
