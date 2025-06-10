import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { HttpClientTestingModule } from '@angular/common/http/testing'; // Added
import { App } from './app';
import { MenuItem } from './components/side-menu/menu-item';
import { Snippet } from './components/sheet/sheet'; // For creating mock MenuItem
// App è standalone e importa già MatToolbarModule, MatIconModule, SideMenuComponent, etc.
// Quindi non dovrebbero essere necessari qui a meno di casi specifici di override o testing profondo.

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let component: App;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App, // App è standalone e importa ciò che serve
        NoopAnimationsModule, // Necessario per i componenti Material Design
        HttpClientTestingModule // Added: RunnerService (dependency of App) needs HttpClient
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    nativeElement = fixture.nativeElement;
    // fixture.detectChanges() sarà chiamata nei singoli test dopo aver manipolato lo stato del componente
  });

  it('should create the app', () => {
    fixture.detectChanges(); // Chiamata iniziale per il setup
    expect(component).toBeTruthy();
  });

  it('should NOT display the menu button if sideMenuItems is empty', () => {
    // component.sideMenuItems è già [] di default dopo le nostre modifiche
    fixture.detectChanges(); // Applica l'associazione dati basata su sideMenuItems vuoto

    // Cerca il pulsante del menu. Ci aspettiamo che NON esista nel DOM a causa di @if.
    const buttonElement = nativeElement.querySelector('button[aria-label="Open menu icon"]');

    expect(buttonElement).toBeNull();
  });

  it('should DISPLAY the menu button if sideMenuItems has items', () => {
    // Modifica sideMenuItems per includere almeno un elemento.
    // La struttura esatta di Snippet non è cruciale qui, solo che l'array non sia vuoto.
    // Per il mock di Snippet, dobbiamo assicurarci che sia conforme all'interfaccia Snippet.
    // L'interfaccia Snippet in sheet.ts è: id: number; type: string; getTayloredBlock: () => Document;
    component.sideMenuItems = [
      {
        label: 'Test Item',
        snippets: [{ id: 1, type: 'text', value: '', getTayloredBlock: () => "<taylored/>" }] // Mock snippet base
      }
    ];
    fixture.detectChanges(); // Applica l'associazione dati

    const buttonElement = nativeElement.querySelector('button[aria-label="Open menu icon"]');
    expect(buttonElement).not.toBeNull();

    // Verifica anche l'icona per maggiore sicurezza, se il bottone esistesse ma l'icona fosse nascosta
    const menuIcon = buttonElement?.querySelector('mat-icon');
    expect(menuIcon?.textContent?.trim()).toBe('menu');
  });

  // Aggiungere qui altri test per App component se necessario

  xdescribe('onNewMenuItem method and app-sheet integration', () => {
    let mockTextSnippet: Snippet;
    let mockMenuItem: MenuItem;

    beforeEach(() => {
      // Initialize mock data usable by tests in this suite
      mockTextSnippet = {
        id: 1,
        type: 'text',
        value: 'Test text for menu item',
        // Provide a simple XMLDocument for getTayloredBlock
        getTayloredBlock: () => '<taylored text="true"><value>Test text for menu item</value></taylored>'
      };
      mockMenuItem = {
        label: 'Test Execution Item',
        snippets: [mockTextSnippet]
      };

      // Ensure sideMenuItems is empty before each test in this describe block
      component.sideMenuItems = [];
      fixture.detectChanges(); // Apply this initial state
    });

    it('onNewMenuItem method should add MenuItem to sideMenuItems', () => {
      expect(component.sideMenuItems.length).toBe(0); // Pre-condition

      component.onNewMenuItem(mockMenuItem);
      fixture.detectChanges(); // Reflect change in component state

      expect(component.sideMenuItems.length).toBe(1);
      expect(component.sideMenuItems).toContain(mockMenuItem);
      // For a more robust check, especially if objects might be cloned:
      expect(component.sideMenuItems[0].label).toBe('Test Execution Item');
      expect(component.sideMenuItems[0].snippets.length).toBe(1);
      expect(component.sideMenuItems[0].snippets[0].value).toBe('Test text for menu item');
    });

    it('should call onNewMenuItem when app-sheet emits newMenuItem event', () => {
      spyOn(component, 'onNewMenuItem').and.callThrough(); // Spy on the method

      const sheetDebugElement = fixture.debugElement.query(By.css('app-sheet'));
      expect(sheetDebugElement).withContext('app-sheet element should be present').toBeTruthy();

      // Simulate app-sheet emitting the event
      sheetDebugElement.triggerEventHandler('newMenuItem', mockMenuItem);
      fixture.detectChanges();

      expect(component.onNewMenuItem).toHaveBeenCalledWith(mockMenuItem);
      expect(component.onNewMenuItem).toHaveBeenCalledTimes(1);

      // Also verify the effect of onNewMenuItem being called
      expect(component.sideMenuItems.length).toBe(1);
      expect(component.sideMenuItems).toContain(mockMenuItem);
    });

    it('adding multiple MenuItems via onNewMenuItem should update sideMenuItems correctly', () => {
      const mockMenuItem2: MenuItem = {
        label: 'Second Test Item',
        snippets: [{
          id: 2, type: 'compute', value: '#!bash\necho "hello"',
          getTayloredBlock: () => '<taylored compute="true"><value>#!bash\necho "hello"</value></taylored>'
        }]
      };

      component.onNewMenuItem(mockMenuItem);
      component.onNewMenuItem(mockMenuItem2);
      fixture.detectChanges();

      expect(component.sideMenuItems.length).toBe(2);
      expect(component.sideMenuItems).toContain(mockMenuItem);
      expect(component.sideMenuItems).toContain(mockMenuItem2);
      expect(component.sideMenuItems[0].label).toBe('Test Execution Item');
      expect(component.sideMenuItems[1].label).toBe('Second Test Item');
    });
  });
});
