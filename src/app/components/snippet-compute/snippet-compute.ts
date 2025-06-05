import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Good practice for standalone components

@Component({
  selector: 'app-snippet-compute',
  standalone: true, // Ensure it is standalone
  imports: [CommonModule], // Add CommonModule
  templateUrl: './snippet-compute.html',
  styleUrl: './snippet-compute.sass'
})
export class SnippetCompute {

}
