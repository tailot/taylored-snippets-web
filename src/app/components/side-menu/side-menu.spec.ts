import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SideMenuComponent } from './side-menu'; // Corrected import name
import { MenuItem } from './menu-item';
import { MatListModule } from '@angular/material/list';
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // Import for Material components animations

describe('SideMenuComponent', () => { // Corrected describe name
  let component: SideMenuComponent;
  let fixture: ComponentFixture<SideMenuComponent>;
  let nativeElement: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SideMenuComponent, // Component being tested
        MatListModule,       // Import MatListModule as it's used in the template
        NoopAnimationsModule // To handle animations from Angular Material
      ]
      // No need to declare SideMenuComponent again if it's standalone and imported
    })
    .compileComponents();

    fixture = TestBed.createComponent(SideMenuComponent);
    component = fixture.componentInstance;
    nativeElement = fixture.nativeElement;
    // fixture.detectChanges() will be called in each test or after setting inputs
  });

  it('should create', () => {
    fixture.detectChanges(); // Initial detection
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
    // Component initializes menuItems to [], so directly setting to undefined might not reflect a real scenario
    // unless an Input is explicitly bound to undefined, which TypeScript might prevent if not `MenuItem[] | undefined`.
    // For this case, given it's initialized, testing with empty array (done above) is sufficient and more realistic.
    component.menuItems = []; // Test default initialized state or explicitly set to empty
    fixture.detectChanges();
    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(0);
  });

  it('should render items correctly even if some items have no label (robustness test)', () => {
    // This tests robustness, though data should conform to MenuItem interface.
    // The @for directive will still render an item. The text content of the link depends on {{ item.label }}.
    // If item.label is undefined, textContent should be empty.
    const mockMenuItems: any[] = [ // Using any to test non-conforming data
      { label: 'Real Label', snippets: [] },
      { /* no label */ snippets: [] } // Item without a label property
    ];
    component.menuItems = mockMenuItems as MenuItem[]; // Cast to MenuItem[] for the component
    fixture.detectChanges();

    const listItems = nativeElement.querySelectorAll('mat-nav-list a');
    expect(listItems.length).toBe(2); // Both items should be rendered
    expect(listItems[0].textContent).toContain('Real Label');
    // For the item without a label, Angular's interpolation {{ item.label }} will result in an empty string.
    expect(listItems[1].textContent).toBe('');
  });

});
