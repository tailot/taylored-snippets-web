import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core'; // IMPORT AGGIUNTO
import { SideMenuComponent } from './side-menu';
import { MenuItem } from './menu-item';
import { MatListModule } from '@angular/material/list';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('SideMenuComponent', () => {
  let component: SideMenuComponent;
  let fixture: ComponentFixture<SideMenuComponent>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SideMenuComponent,
        MatListModule,
        NoopAnimationsModule
      ],
      providers: [provideZonelessChangeDetection()] // PROVIDERS AGGIUNTI
    })
    .compileComponents();

    fixture = TestBed.createComponent(SideMenuComponent);
    component = fixture.componentInstance;
    nativeElement = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render labels from menuItems input', () => {
    const mockMenuItems: MenuItem[] = [
      { label: 'Test Label 1', snippets: [] },
      { label: 'Test Label 2', snippets: [] }
    ];
    component.menuItems = mockMenuItems;
    fixture.detectChanges();
    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain('Test Label 1');
    expect(listItems[1].textContent).toContain('Test Label 2');
  });

  it('should render no items if menuItems is an empty array', () => {
    component.menuItems = [];
    fixture.detectChanges();
    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(0);
  });

  it('should render no items if menuItems is undefined (component initializes it, but good to check boundary)', () => {
    component.menuItems = [];
    fixture.detectChanges();
    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(0);
  });

  it('should render items correctly even if some items have no label (robustness test)', () => {
    const mockMenuItems: any[] = [
      { label: 'Real Label', snippets: [] },
      { snippets: [] }
    ];
    component.menuItems = mockMenuItems as MenuItem[];
    fixture.detectChanges();
    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain('Real Label');
    expect(listItems[1].textContent).toBe('');
  });

});
