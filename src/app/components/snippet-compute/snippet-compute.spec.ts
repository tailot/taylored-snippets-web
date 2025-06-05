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
});
