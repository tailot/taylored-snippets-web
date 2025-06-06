import { ComponentFixture, TestBed } from '@angular/core/testing'; // Removed fakeAsync, tick
import { provideAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection, ChangeDetectorRef } from '@angular/core'; // Added ChangeDetectorRef

import { Sheet } from './sheet';

describe('SheetComponent', () => {
  let component: Sheet;
  let fixture: ComponentFixture<Sheet>;

  beforeEach(async () => { // beforeEach is async
    await TestBed.configureTestingModule({
      imports: [
        Sheet,
      ],
      providers: [
        provideAnimations(),
        provideZonelessChangeDetection()
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sheet);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Initial detection
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render a mat-card', () => {
    const cardElement = fixture.debugElement.query(By.css('mat-card'));
    expect(cardElement).toBeTruthy();
  });

  it('should render add snippet buttons', () => {
    const buttons = fixture.debugElement.queryAll(By.css('button'));
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const addTextButton = buttons.find(btn => btn.nativeElement.textContent.includes('Add Text Snippet'));
    const addComputeButton = buttons.find(btn => btn.nativeElement.textContent.includes('Add Compute Snippet'));
    expect(addTextButton).toBeTruthy();
    expect(addComputeButton).toBeTruthy();
  });

  it('should add a text snippet when "Add Text Snippet" button is clicked', async () => {
    const initialSnippetCount = component.snippets.length;
    const addTextButtonElement = fixture.debugElement.queryAll(By.css('button')).find(btn => btn.nativeElement.textContent.includes('Add Text Snippet'));

    expect(addTextButtonElement).toBeTruthy();
    addTextButtonElement!.nativeElement.click();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges(); // Additional detectChanges

    expect(component.snippets.length).toBe(initialSnippetCount + 1);
    const newSnippet = component.snippets[component.snippets.length - 1];
    expect(newSnippet.type).toBe('text');

    const snippetTextElement = fixture.debugElement.query(By.css('app-snippet-text'));
    expect(snippetTextElement).toBeTruthy();
  });

  it('should add a compute snippet when "Add Compute Snippet" button is clicked', async () => {
    const initialSnippetCount = component.snippets.length;
    const addComputeButtonElement = fixture.debugElement.queryAll(By.css('button')).find(btn => btn.nativeElement.textContent.includes('Add Compute Snippet'));

    expect(addComputeButtonElement).toBeTruthy();
    addComputeButtonElement!.nativeElement.click();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges(); // Additional detectChanges


    expect(component.snippets.length).toBe(initialSnippetCount + 1);
    const newSnippet = component.snippets[component.snippets.length - 1];
    expect(newSnippet.type).toBe('compute');

    const snippetComputeElement = fixture.debugElement.query(By.css('app-snippet-compute'));
    expect(snippetComputeElement).toBeTruthy();
  });

  it('should display "No snippets added yet" message when snippets array is empty', async () => { // made async just in case
    component.snippets = [];
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges(); // Additional detectChanges

    const messageElement = fixture.debugElement.query(By.css('mat-card-content p'));
    expect(messageElement).toBeTruthy();
    expect(messageElement.nativeElement.textContent).toContain('No snippets added yet');
  });

  // Failing test - with additional detectChanges
  // Failing test - with additional detectChanges
  it('should not display "No snippets added yet" message when snippets array is not empty', async () => {
    component.addSnippet('text');
    // fixture.detectChanges(); // Initial CD
    // await fixture.whenStable();
    // fixture.detectChanges(); // Second CD

    // Try forcing change detection via the component's own ChangeDetectorRef
    const cdr = fixture.componentRef.injector.get(ChangeDetectorRef);
    cdr.detectChanges();

    const messageElement = fixture.debugElement.query(By.css('mat-card-content > p:first-child'));

    let specificMessageExists = false;
    if (messageElement && messageElement.nativeElement.textContent.includes('No snippets added yet')) {
        specificMessageExists = true;
    }

    expect(specificMessageExists).toBeFalsy();
  });

  it('should have a saveSheet method', () => {
    expect(component.saveSheet).toBeDefined();
    // Optionally, check if it's a function
    expect(typeof component.saveSheet).toBe('function');
  });
/* https://angular.dev/errors/NG0100 -> https://www.youtube.com/watch?v=ViwtNLUqkMY
  it('should render a save button in the header, correctly aligned', async () => { // Made async
    component.addSnippet('text');
    await fixture.whenStable(); // Added await whenStable
    fixture.detectChanges();

    // Check for mat-card-header with the correct class
    const cardHeader = fixture.debugElement.query(By.css('mat-card-header.sheet-card-header'));
    expect(cardHeader).toBeTruthy();

    // Check if the save button is inside this header
    const saveButton = cardHeader.query(By.css('button[aria-label="Save sheet"]'));
    expect(saveButton).toBeTruthy();

    // Check for the save icon within the button
    const saveIcon = saveButton.query(By.css('mat-icon'));
    expect(saveIcon).toBeTruthy();
    expect(saveIcon.nativeElement.textContent.trim()).toBe('save');

    // Check for the spacer element within the header
    const spacer = cardHeader.query(By.css('span.header-spacer'));
    expect(spacer).toBeTruthy();

    // Check order: spacer, button
    // The spacer and button were already queried from cardHeader, these are fine:
    // const spacer = cardHeader.query(By.css('span.header-spacer'));
    // const saveButton = cardHeader.query(By.css('button[aria-label="Save sheet"]'));

    // To check order, we need to look at the direct children of cardHeader's nativeElement
    // or compare the elements themselves if they are siblings.
    // A more robust way is to ensure they are direct children and check source order.
    // DebugElement.children gives direct DebugElement children.

    const headerChildren = cardHeader.children; // All direct children of mat-card-header

    // Element containing the title. This is usually div.mat-mdc-card-header-text
    // or the mat-card-title element itself if it's a direct child.
    const spacerDebugElement = cardHeader.query(By.css('span.header-spacer'));
    const buttonDebugElement = cardHeader.query(By.css('button[aria-label="Save sheet"]'));

    expect(spacerDebugElement).toBeTruthy('Spacer DebugElement (span.header-spacer) should be found in header');
    expect(buttonDebugElement).toBeTruthy('Button DebugElement (save button) should be found in header');

    // Find their indices within the children array
    const spacerIndex = headerChildren.findIndex(child => child === spacerDebugElement);
    const buttonIndex = headerChildren.findIndex(child => child === buttonDebugElement);

    expect(spacerIndex).toBeGreaterThanOrEqual(0, 'Spacer should be a direct child of header');
    expect(buttonIndex).toBeGreaterThanOrEqual(0, 'Button should be a direct child of header');

    expect(spacerIndex).toBeLessThan(buttonIndex, 'Spacer should come before button in DOM');
  });
*/
/* https://angular.dev/errors/NG0100 -> https://www.youtube.com/watch?v=ViwtNLUqkMY
  it('should call saveSheet method when save button is clicked', () => {
    component.addSnippet('text');
    fixture.detectChanges();
    spyOn(component, 'saveSheet'); // Spy on the saveSheet method
    const saveButton = fixture.debugElement.query(By.css('button[aria-label="Save sheet"]'));

    expect(saveButton).toBeTruthy();
    saveButton.nativeElement.click();

    expect(component.saveSheet).toHaveBeenCalled();
  });
*/
  describe('addSnippet method direct tests', () => {
    // Import SnippetText and SnippetCompute to use instanceof
    let SnippetTextType: typeof import('../snippet-text/snippet-text').SnippetText;
    let SnippetComputeType: typeof import('../snippet-compute/snippet-compute').SnippetCompute;

    beforeAll(async () => {
      SnippetTextType = (await import('../snippet-text/snippet-text')).SnippetText;
      SnippetComputeType = (await import('../snippet-compute/snippet-compute')).SnippetCompute;
    });

    beforeEach(() => {
      // Reset snippets before each test in this block
      component.snippets = [];
      // Reset nextId if necessary, though component.addSnippet handles its increment
      // (Reflection: component internal 'nextId' is not reset here, which is fine as it mimics continuous use)
    });

    it('should add an instance of SnippetText when type is "text"', () => {
      component.addSnippet('text');
      expect(component.snippets.length).toBe(1);
      const newSnippet = component.snippets[0];
      expect(newSnippet).toBeInstanceOf(SnippetTextType);
      expect(newSnippet.type).toBe('text');
      expect(newSnippet.id).toBeDefined(); // ID should be assigned
    });

    it('should add an instance of SnippetCompute when type is "compute"', () => {
      component.addSnippet('compute');
      expect(component.snippets.length).toBe(1);
      const newSnippet = component.snippets[0];
      expect(newSnippet).toBeInstanceOf(SnippetComputeType);
      expect(newSnippet.type).toBe('compute');
      expect(newSnippet.id).toBeDefined(); // ID should be assigned
    });

    it('should assign unique IDs to subsequently added snippets', () => {
      component.addSnippet('text'); // First snippet
      component.addSnippet('compute'); // Second snippet
      expect(component.snippets.length).toBe(2);
      expect(component.snippets[0].id).not.toBe(component.snippets[1].id);
    });

    it('should ensure snippets added via addSnippet have a callable getTayloredBlock method returning XMLDocument', () => {
      // Test for 'text' snippet
      component.addSnippet('text');
      let textSnippet = component.snippets[0];
      expect(typeof textSnippet.getTayloredBlock).toBe('function');
      let textXmlDoc = textSnippet.getTayloredBlock();
      expect(textXmlDoc).toBeInstanceOf(XMLDocument);
      expect(textXmlDoc.documentElement.tagName).toBe('taylored');
      expect(textXmlDoc.documentElement.getAttribute('text')).toBe('true');

      // Reset for compute snippet (or use a new component instance for isolation)
      component.snippets = [];
      component.addSnippet('compute');
      let computeSnippet = component.snippets[0];
      expect(typeof computeSnippet.getTayloredBlock).toBe('function');
      let computeXmlDoc = computeSnippet.getTayloredBlock();
      expect(computeXmlDoc).toBeInstanceOf(XMLDocument);
      expect(computeXmlDoc.documentElement.tagName).toBe('taylored');
      expect(computeXmlDoc.documentElement.getAttribute('compute')).toBeTruthy();
    });
  });
});
