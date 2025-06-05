import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';

import { Snippet } from '../sheet/sheet';


@Component({
  selector: 'app-snippet-text',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatInputModule, TextFieldModule],
  templateUrl: './snippet-text.html',
  styleUrl: './snippet-text.sass'
})
export class SnippetText implements Snippet {
  type: 'text' = 'text';

  @Input() id!: number;
  @Output() empty = new EventEmitter<number>();

  text: string = '';

  getTayloredBlock(): XMLDocument {
    const xmlString = `<taylored number="${this.id}" text="true">${this.text}</taylored>`;
    return new DOMParser().parseFromString(xmlString, "text/xml");
  }

  onTextChange(): void {
    if (this.text.trim() === '') {
      this.empty.emit(this.id);
    }
  }
}
