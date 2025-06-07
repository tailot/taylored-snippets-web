import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { HttpClientTestingModule } from '@angular/common/http/testing'; // Added
import { App } from './app';
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
        snippets: [{ id: 1, type: 'text', value: '', getTayloredBlock: () => new Document() }] // Mock snippet base
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
});
