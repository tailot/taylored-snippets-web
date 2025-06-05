import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SnippetText } from './snippet-text';

describe('SnippetText', () => {
  let component: SnippetText;
  let fixture: ComponentFixture<SnippetText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnippetText]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SnippetText);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
