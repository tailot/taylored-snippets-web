import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Snippet } from '../sheet/sheet';


@Component({
  selector: 'app-snippet-text',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './snippet-text.html',
  styleUrl: './snippet-text.sass'
})
export class SnippetText implements Snippet {
  type: 'text' = 'text';

  @Input() id!: number;
  @Output() empty = new EventEmitter<number>();

  text: string = '';

  onTextChange(): void {
    if (this.text.trim() === '') {
      this.empty.emit(this.id);
    }
  }
}
