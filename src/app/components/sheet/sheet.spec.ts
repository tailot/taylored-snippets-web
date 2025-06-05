import { ComponentFixture, TestBed } from '@angular/core/testing'; // Removed fakeAsync, tick
import { provideAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';

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
  it('should not display "No snippets added yet" message when snippets array is not empty', async () => {
    component.addSnippet('text');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();      // <<< The crucial addition for this test

    const messageElement = fixture.debugElement.query(By.css('mat-card-content > p:first-child'));

    let specificMessageExists = false;
    if (messageElement && messageElement.nativeElement.textContent.includes('No snippets added yet')) {
        specificMessageExists = true;
    }

    expect(specificMessageExists).toBeFalsy();
  });

});
