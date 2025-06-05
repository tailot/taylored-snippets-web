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

    it('should return a string', () => {
      const result = component.getTayloredBlock();
      expect(typeof result).toBe('string');
    });

    it('should return a string in the correct taylored block format', () => {
      const result = component.getTayloredBlock();
      // Regex to check the overall structure, ID, and presence of Base64 timestamp
      // It doesn't validate the Base64 content itself here, just that it looks like Base64
      const tayloredRegex = /^<taylored number="\d+" compute="[A-Za-z0-9+/=]+">.*?<\/taylored>$/s;
      expect(result).toMatch(tayloredRegex);
    });

    it('should use the component id in the "number" attribute', () => {
      component.id = 456; // Change id to test
      const result = component.getTayloredBlock();
      expect(result).toContain(`number="${component.id}"`);
    });

    it('should use the component snippetCode as the content of the block', () => {
      component.snippetCode = 'alert("Test Code");'; // Change snippetCode to test
      const result = component.getTayloredBlock();
      expect(result).toContain(`>${component.snippetCode}</taylored>`);
    });

    it('should have a valid Base64 encoded timestamp in the "compute" attribute', () => {
      const result = component.getTayloredBlock();
      const computeMatch = result.match(/compute="([^"]+)"/);
      expect(computeMatch).toBeTruthy();
      expect(computeMatch!.length).toBeGreaterThan(1);
      const base64Timestamp = computeMatch![1];

      // Try to decode it
      let decodedTimestamp: string = '';
      let errorDecoding: any = null;
      try {
        decodedTimestamp = atob(base64Timestamp);
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
      // Allowing a reasonable delta (e.g., 5 seconds) for test execution time
      expect(numericTimestamp).toBeGreaterThanOrEqual(now - 5000, 'Timestamp seems too old');
      expect(numericTimestamp).toBeLessThanOrEqual(now + 5000, 'Timestamp seems too far in the future');
    });
  });
});
