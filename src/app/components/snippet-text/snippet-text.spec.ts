import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetText } from './snippet-text';

describe('SnippetTextComponent', () => {
  let component: SnippetText;
  let fixture: ComponentFixture<SnippetText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SnippetText ], // It's standalone
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
    const pElement = fixture.debugElement.nativeElement.querySelector('p');
    expect(pElement).toBeTruthy();
    expect(pElement.textContent).toContain('This is a Text Snippet');
  });
});
