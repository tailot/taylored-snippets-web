import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetText } from './snippet-text';
import { FormsModule } from '@angular/forms'; // Required for ngModel
import { MatInputModule } from '@angular/material/input'; // Required for matInput
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Required for some Material components

describe('SnippetTextComponent', () => {
  let component: SnippetText;
  let fixture: ComponentFixture<SnippetText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SnippetText, // It's standalone
        FormsModule,      // For ngModel
        MatInputModule,   // For matInput used in textarea
        NoopAnimationsModule // Disable animations for tests
      ],
      providers: [provideZonelessChangeDetection()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetText);
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

  it('should display text snippet placeholder content in textarea', () => {
    const textAreaElement = fixture.debugElement.nativeElement.querySelector('textarea');
    expect(textAreaElement).toBeTruthy(); // Check if the textarea exists
    expect(textAreaElement.placeholder).toContain('Enter your text...'); // Check its placeholder
  });

  describe('value property two-way binding', () => {
    it('should update textarea when component value changes', async () => {
      component.value = 'New text value';
      fixture.detectChanges(); // Trigger change detection
      await fixture.whenStable(); // Wait for async operations like ngModel to settle
      const textareaElement = fixture.debugElement.nativeElement.querySelector('textarea');
      expect(textareaElement.value).toBe('New text value');
    });

    it('should update component value when textarea input changes', async () => {
      const textareaElement = fixture.debugElement.nativeElement.querySelector('textarea');
      textareaElement.value = 'User input text';
      textareaElement.dispatchEvent(new Event('input')); // Simulate input event
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.value).toBe('User input text');
    });
  });

  describe('getTayloredBlock method (using value)', () => {
    beforeEach(() => {
      // Set default values for id and value for these tests
      component.id = 789;
      component.value = 'This is some sample text.';
      // fixture.detectChanges(); // Not strictly necessary for method testing
    });

    it('should return a string', () => {
      const result = component.getTayloredBlock();
      expect(typeof result).toBe('string');
    });

    xit('should return an XML string with the correct structure and content using value', () => {
      const result = component.getTayloredBlock();
      expect(typeof result).toBe('string');
      const doc = new DOMParser().parseFromString(result, "text/xml");

      const rootElement = doc.documentElement;
      expect(rootElement.tagName).toBe('taylored');
      expect(rootElement.getAttribute('number')).toBe(component.id.toString());
      expect(rootElement.getAttribute('text')).toBe('true'); // This attribute distinguishes text snippets in XML
      expect(rootElement.textContent).toBe(component.value); // Check component.value
    });

    it('should use the component id in the "number" attribute of the XML string', () => {
      component.id = 101; // Change id to test
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      expect(rootElement.getAttribute('number')).toBe('101');
    });

    xit('should use the component value as the text content of the XML string', () => {
      component.value = 'More detailed text for testing purposes.'; // Change value to test
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      expect(rootElement.textContent).toBe('More detailed text for testing purposes.');
    });

    xit('should have a "text" attribute with the value "true" in the XML string', () => {
      const result = component.getTayloredBlock();
      const doc = new DOMParser().parseFromString(result, "text/xml");
      const rootElement = doc.documentElement;
      expect(rootElement.getAttribute('text')).toBe('true');
    });
  });
});
