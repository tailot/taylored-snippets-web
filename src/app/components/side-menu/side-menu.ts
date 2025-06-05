import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [MatListModule],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.sass'
})
export class SideMenuComponent {

}
