import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RunnerService } from '../../services/runner.service';

@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.css']
})
export class FileManagerComponent implements OnInit, OnDestroy {
  public listedFiles: any[] = [];
  public currentListingPath: string = './';
  private directoryListingSubscription: Subscription | undefined;

  private runnerService = inject(RunnerService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.directoryListingSubscription = this.runnerService.directoryListing$.subscribe(listing => {
      if (listing && Array.isArray(listing.files)) {
        this.listedFiles = listing.files;
        this.currentListingPath = listing.path;
        this.cdr.detectChanges();
      } else {
        console.warn('Received malformed or empty directory listing:', listing);
        this.listedFiles = [];
        this.cdr.detectChanges();
      }
    });
    this.listCurrentDirectory('./'); // Automatically list root directory on init
  }

  public listCurrentDirectory(path: string = './'): void {
    this.runnerService.listRunnerDirectory(path);
  }

  public downloadSelectedFile(filename: string): void {
    const sessionId = this.runnerService.getCurrentSessionId();
    if (!sessionId) {
      console.error("Cannot download file: Session ID is not available.");
      // TODO: Show user-facing error in the component's template
      return;
    }

    let fullPath = '';
    if (this.currentListingPath === './' || this.currentListingPath === '.' ) {
      fullPath = filename;
    } else if (this.currentListingPath.endsWith('/')) {
      fullPath = this.currentListingPath + filename;
    } else {
      fullPath = this.currentListingPath + '/' + filename;
    }

    if (fullPath.startsWith('./')) {
      fullPath = fullPath.substring(2);
    }

    this.runnerService.downloadFile(sessionId, fullPath).subscribe({
      next: (blob) => {
        try {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
          console.log(`File ${filename} download initiated.`);
        } catch (e) {
          console.error('Error creating object URL or triggering download:', e);
          // TODO: Show user-facing error
        }
      },
      error: (err) => {
        console.error(`Error downloading file ${filename}:`, err);
        // TODO: Show user-facing error
      }
    });
  }

  public constructParentPath(): string {
    if (this.currentListingPath === './' || this.currentListingPath === '/' || this.currentListingPath === '') {
      return './'; // Already at root or an invalid state to go up further sensibly
    }
    // Normalize path: remove trailing slash if any, for consistent splitting
    const normalizedPath = this.currentListingPath.endsWith('/') ?
                           this.currentListingPath.substring(0, this.currentListingPath.length - 1) :
                           this.currentListingPath;

    const parts = normalizedPath.split('/');
    if (parts.length <= 1) {
      // If it was 'somedir' (no slashes) or after splitting it's just one part, parent is root
      return './';
    }
    parts.pop(); // Remove the current directory part
    const parentPath = parts.join('/');
    return parentPath === '' ? './' : parentPath + '/'; // Ensure trailing slash for directories
  }

  public goToParentDirectory(): void {
    const parentPath = this.constructParentPath();
    this.listCurrentDirectory(parentPath);
  }

  ngOnDestroy(): void {
    if (this.directoryListingSubscription) {
      this.directoryListingSubscription.unsubscribe();
    }
  }
}
