import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Good practice for standalone components

@Component({
  selector: 'app-snippet-text',
  standalone: true, // Ensure it is standalone
  imports: [CommonModule], // Add CommonModule
  templateUrl: './snippet-text.html',
  styleUrl: './snippet-text.sass'
})
export class SnippetText {

}
