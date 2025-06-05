import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { App } from './app';
import { Sheet } from './components/sheet/sheet'; // Assuming App imports Sheet

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App], // App is standalone
      // If App imports Sheet directly, Sheet's standalone nature handles its template.
      // No need to declare SheetComponent unless App's template uses it AND Sheet isn't standalone (but it is).
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]) // Basic router provider for tests if App uses <router-outlet> or routerLink
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Add more tests for App component if necessary
});
