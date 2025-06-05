import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetText } from './snippet-text';

describe('SnippetTextComponent', () => {
  let component: SnippetText;
  let fixture: ComponentFixture<SnippetText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnippetText], // It's standalone
      providers: [provideZonelessChangeDetection()]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SnippetText);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display text snippet placeholder content', () => {
    const textAreaElement = fixture.debugElement.nativeElement.querySelector('textarea');
    expect(textAreaElement).toBeTruthy(); // Check if the textarea exists
    expect(textAreaElement.placeholder).toContain('Enter your text...'); // Check its placeholder
  });

  describe('getTayloredBlock method', () => {
    beforeEach(() => {
      // Set default values for id and text for these tests
      component.id = 789;
      component.text = 'This is some sample text.';
      // fixture.detectChanges(); // Not strictly necessary for method testing
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
      expect(rootElement.getAttribute('text')).toBe('true');
      expect(rootElement.textContent).toBe(component.text);
    });

    it('should use the component id in the "number" attribute of the XMLDocument', () => {
      component.id = 101; // Change id to test
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
      expect(rootElement.getAttribute('number')).toBe('101');
    });

    it('should use the component text as the text content of the XMLDocument', () => {
      component.text = 'More detailed text for testing purposes.'; // Change text to test
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
      expect(rootElement.textContent).toBe('More detailed text for testing purposes.');
    });

    it('should have a "text" attribute with the value "true"', () => {
      const result = component.getTayloredBlock();
      const rootElement = result.documentElement;
      expect(rootElement.getAttribute('text')).toBe('true');
    });
  });
});
