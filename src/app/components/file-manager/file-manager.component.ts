/**
 * @fileoverview This file defines the FileManagerComponent, which allows users to browse and download files
 * from the runner's file system.
 */
import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject, Input, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon'; // Added
import { RunnerService, FileContent } from '../../services/runner.service';

/**
 * Component for managing files and directories in the runner environment.
 * It allows listing directories, navigating through them, and downloading files.
 */
@Component({
  selector: 'app-file-manager',
  standalone: true,
  imports: [CommonModule, MatIconModule], // Added MatIconModule
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.sass']
})
export class FileManagerComponent implements OnInit, OnDestroy {
  /**
   * An array of files and directories currently listed.
   */
  public listedFiles: any[] = [];
  /**
   * The path of the currently listed directory.
   */
  public currentListingPath: string = './';
  /**
   * Subscription to the directory listing observable from RunnerService.
   */
  private directoryListingSubscription: Subscription | undefined;
  /**
   * Subscription to the runner readiness observable from RunnerService.
   */
  private runnerReadySubscription: Subscription | undefined;
  /**
   * Subscription to the file content observable from RunnerService, used for downloads.
   */
  private fileContentSubscription: Subscription | undefined;

  /** Subscription to the refreshTrigger EventEmitter. */
  private refreshTriggerSubscription: Subscription | undefined;

  /**
   * Service for interacting with the code execution runner.
   * Used for listing directories, downloading files, etc.
   */
  private runnerService = inject(RunnerService);

  /**
   * Reference to Angular's ChangeDetectorRef, used to manually trigger change detection
   * when asynchronous operations update component data outside of Angular's default detection cycle.
   */
  private cdr = inject(ChangeDetectorRef);

  /** Stores the last known runner readiness state. */
  private isRunnerCurrentlyReady: boolean = false;

  /**
   * An EventEmitter that, when triggered with `true`, signals the component to refresh
   * its current directory listing, provided the runner is ready.
   * This allows parent components to programmatically request a refresh of the file manager's view.
   */
  @Input() public refreshTrigger = new EventEmitter<boolean>();


  /**
   * Initializes the component, subscribing to runner events for directory listings and readiness.
   * It lists the root directory ('./') once the runner is ready.
   */
  ngOnInit(): void {
    // Subscription to directory listing updates
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

    // Subscription to file content for downloads
    this.fileContentSubscription = this.runnerService.fileContent$.subscribe((fileData: FileContent) => {
      this.triggerBrowserDownload(fileData.path, fileData.content);
    });

    // Subscription to runner readiness state
    this.runnerReadySubscription = this.runnerService.isRunnerReady$.subscribe(isReady => {
      this.isRunnerCurrentlyReady = isReady; // Store the latest readiness state
      if (isReady) {
        // When the runner is ready, list the directory stored in currentListingPath.
        // currentListingPath is initialized to './', so it will load the root on first readiness.
        console.log(`File Manager: Runner is ready. Listing directory: ${this.currentListingPath}`);
        this.listCurrentDirectory(this.currentListingPath);
      } else {
        // Runner is not ready
        console.log('File Manager: Runner is not ready. Clearing file list.');
        this.listedFiles = []; // Clear files if runner becomes not ready
        this.cdr.detectChanges();
      }
    });

    // Subscription to the refreshTrigger input EventEmitter
    if (this.refreshTrigger) {
      this.refreshTriggerSubscription = this.refreshTrigger.subscribe((shouldRefresh: boolean) => {
        if (shouldRefresh && this.isRunnerCurrentlyReady) {
          this.listCurrentDirectory(this.currentListingPath);
        }
      });
    }
    // The initial call to listCurrentDirectory is now handled by the isRunnerReady$ subscription
  }


  /**
   * Requests the RunnerService to list the contents of the specified directory path.
   * @param path The directory path to list. Defaults to './' (root).
   */
  public listCurrentDirectory(path: string = './'): void {
    this.runnerService.listRunnerDirectory(path);
  }

  /**
   * Constructs the full path for a given filename and requests its download via RunnerService.
   * @param filename The name of the file to download.
   */
  public downloadSelectedFile(filename: string): void {
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

    this.runnerService.requestFileDownload(fullPath);
  }

  /**
   * Triggers a browser download for the given file content.
   * @param filePath The path of the file being downloaded (used to extract filename).
   * @param content The file content as an ArrayBuffer.
   */
  private triggerBrowserDownload(filePath: string, content: ArrayBuffer): void {
    try {
      const filename = filePath.split('/').pop() || filePath;
      const blob = new Blob([content], { type: 'application/octet-stream' });
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
  }

  /**
   * Constructs the path of the parent directory relative to the current path.
   * @returns The path of the parent directory, or './' if already at the root.
   */
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

  /**
   * Navigates to the parent directory of the current path and lists its contents.
   */
  public goToParentDirectory(): void {
    const parentPath = this.constructParentPath();
    this.listCurrentDirectory(parentPath);
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy(): void {
    if (this.directoryListingSubscription) {
      this.directoryListingSubscription.unsubscribe();
    }
    if (this.fileContentSubscription) {
      this.fileContentSubscription.unsubscribe();
    }
    if (this.runnerReadySubscription) {
      this.runnerReadySubscription.unsubscribe();
    }
    if (this.refreshTriggerSubscription) {
      this.refreshTriggerSubscription.unsubscribe();
    }
  }
}