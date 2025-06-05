import { Component } from '@angular/core';
import { SnippetText } from '../snippet-text/snippet-text';
import { SnippetCompute } from '../snippet-compute/snippet-compute';

@Component({
  selector: 'app-sheet',
  imports: [SnippetCompute, SnippetText],
  templateUrl: './sheet.html',
  styleUrl: './sheet.sass'
})
export class Sheet {

}
