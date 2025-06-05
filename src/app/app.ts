import { Component } from '@angular/core';
import { Sheet } from './components/sheet/sheet';

@Component({
  selector: 'app-root',
  imports: [Sheet],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected title = 'taylored-snippets-web';
}
