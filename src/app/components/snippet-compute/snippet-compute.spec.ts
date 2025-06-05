import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SnippetCompute } from './snippet-compute';

describe('SnippetComputeComponent', () => {
  let component: SnippetCompute;
  let fixture: ComponentFixture<SnippetCompute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ SnippetCompute ], // It's standalone
      providers: [provideZonelessChangeDetection()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnippetCompute);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display compute snippet placeholder content', () => {
    const pElement = fixture.debugElement.nativeElement.querySelector('p');
    expect(pElement).toBeTruthy();
    expect(pElement.textContent).toContain('This is a Compute Snippet');
  });
});
