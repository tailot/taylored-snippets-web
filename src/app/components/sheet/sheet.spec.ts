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

  it('should render a save button in the header, correctly aligned', () => {
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

    // Check order: title, spacer, button
    const titleElement = cardHeader.query(By.css('mat-card-title'));
    expect(titleElement).toBeTruthy('Title element should be present in header');

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
    let titleContainerElement = headerChildren.find(child => child.nativeElement.classList && child.nativeElement.classList.contains('mat-mdc-card-header-text'));
    if (!titleContainerElement) {
      // Fallback if mat-mdc-card-header-text is not a direct child (e.g. no avatar)
      // or if mat-card-title itself is the direct child we are ordering.
      titleContainerElement = cardHeader.query(By.css('mat-card-title'));
    }

    const spacerDebugElement = cardHeader.query(By.css('span.header-spacer'));
    const buttonDebugElement = cardHeader.query(By.css('button[aria-label="Save sheet"]'));

    expect(titleContainerElement).toBeTruthy('Title container element should be found in header');
    expect(spacerDebugElement).toBeTruthy('Spacer DebugElement (span.header-spacer) should be found in header');
    expect(buttonDebugElement).toBeTruthy('Button DebugElement (save button) should be found in header');

    // Find their indices within the children array
    const titleContainerIndex = headerChildren.findIndex(child => child === titleContainerElement);
    const spacerIndex = headerChildren.findIndex(child => child === spacerDebugElement);
    const buttonIndex = headerChildren.findIndex(child => child === buttonDebugElement);

    expect(titleContainerIndex).toBeGreaterThanOrEqual(0, 'Title container should be a direct child of header');
    expect(spacerIndex).toBeGreaterThanOrEqual(0, 'Spacer should be a direct child of header');
    expect(buttonIndex).toBeGreaterThanOrEqual(0, 'Button should be a direct child of header');

    expect(titleContainerIndex).toBeLessThan(spacerIndex, 'Title container should come before spacer in DOM');
    expect(spacerIndex).toBeLessThan(buttonIndex, 'Spacer should come before button in DOM');
  });

  it('should call saveSheet method when save button is clicked', () => {
    spyOn(component, 'saveSheet'); // Spy on the saveSheet method
    const saveButton = fixture.debugElement.query(By.css('button[aria-label="Save sheet"]'));

    expect(saveButton).toBeTruthy();
    saveButton.nativeElement.click();

    expect(component.saveSheet).toHaveBeenCalled();
  });
});
