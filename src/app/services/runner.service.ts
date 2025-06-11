import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
/**
 * @fileoverview This service manages the lifecycle and communication with a dedicated runner instance.
 * It handles provisioning, deprovisioning, sending snippets for execution, and receiving results via Socket.IO.
 * It also supports file system operations like listing directories and downloading files from the runner.
 */
import { io, Socket } from 'socket.io-client'; // Using official socket.io-client
import { environment } from '../environments/environments';

/**
 * Represents the output or error from a snippet execution.
 */
export interface SnippetOutput {
  /** The ID of the snippet this output belongs to. */
  id: number;
  /** The standard output from the snippet, if any. */
  output?: string;
  /** The error message from the snippet execution, if any. */
  error?: string;
}

/**
 * Represents the content of a file requested from the runner.
 */
export interface FileContent {
  /** The path of the file. */
  path: string;
  /** The content of the file as an ArrayBuffer. */
  content: ArrayBuffer;
}

/**
 * RunnerService is an Angular service provided at the root level, responsible for managing
 * the lifecycle and communication with a dedicated `runner.js` instance.
 * This service handles provisioning (requesting a new runner instance from an
 * orchestrator), deprovisioning (terminating the runner instance), and sending
 * messages or snippets to the runner via Socket.IO. It also listens for output and errors
 * from the runner.
 */
@Injectable({
  providedIn: 'root'
})
export class RunnerService implements OnDestroy {
  /** URL of the orchestrator service, retrieved from environment configuration. */
  private orchestratorUrl = environment.orchestrator;

  /** Interval in milliseconds for sending heartbeat signals to the orchestrator. */
  private HEARTBEAT_INTERVAL_MS = 60 * 500; // 5 minutes
  /** Stores the ID of the interval timer for the heartbeat, allowing it to be cleared. */
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Subject that holds the current runner's endpoint URL. Emits null if no runner is active. */
  private runnerEndpointSubject = new BehaviorSubject<string | null>(null);
  /** Observable stream of the runner's endpoint URL. Components can subscribe to this to know the runner's address. */
  public runnerEndpoint$: Observable<string | null> = this.runnerEndpointSubject.asObservable();

  /** Subject for emitting snippet execution outputs or errors. */
  private snippetOutputSubject = new Subject<SnippetOutput>();
  /** Observable stream of snippet outputs. Components subscribe to this to receive results from executed snippets. */
  public snippetOutput$: Observable<SnippetOutput> = this.snippetOutputSubject.asObservable();

  /** Subject for emitting directory listing results from the runner. */
  private directoryListingSubject = new Subject<{ path: string, files: any[] }>();
  /** Observable stream of directory listings. Components use this to display file browser contents. */
  public directoryListing$: Observable<{ path: string, files: any[] }> = this.directoryListingSubject.asObservable();

  /** Subject for emitting the content of a requested file. */
  private fileContentSubject = new Subject<FileContent>();
  /** Observable stream of file contents. Used to handle file downloads. */
  public fileContent$: Observable<FileContent> = this.fileContentSubject.asObservable();

  /** Subject indicating whether the runner is connected and ready to process requests. */
  private isRunnerReadySubject = new BehaviorSubject<boolean>(false);
  /** Observable stream indicating runner readiness. UI components can use this to enable/disable features. */
  public isRunnerReady$: Observable<boolean> = this.isRunnerReadySubject.asObservable();

  /** Stores the unique session ID for the currently provisioned runner instance. */
  private currentSessionId: string | null = null;
  /** The Socket.IO client instance for communicating with the runner. */
  private runnerSocket: Socket | null = null;

  /**
   * Constructs the RunnerService.
   * @param http Angular HttpClient for making HTTP requests to the orchestrator.
   * Initializes a 'beforeunload' event listener to attempt deprovisioning the runner when the user leaves the page.
   */
  constructor(private http: HttpClient) {
    // Attempt to deprovision if the window is closed or the page is refreshed
    // This is not foolproof but can help in some scenarios.
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Handles the 'beforeunload' event (e.g., page refresh or close).
   * Attempts a synchronous deprovisioning of the runner. This is a best-effort approach
   * as browsers have limitations on operations during 'beforeunload'.
   * @param event The BeforeUnloadEvent.
   */
  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Standard way to ask for user confirmation before leaving the page, but we use it for deprovisioning
    if (this.currentSessionId) {
      // Note: Most browsers will not guarantee asynchronous operations (like HTTP requests)
      // in 'beforeunload'. navigator.sendBeacon is preferable for telemetry but not suitable for all POSTs.
      // This call may not complete successfully.
      // A more robust solution involves backend session timeouts for runners.
      this.deprovisionRunnerSync();
    }
  };

  /**
   * Attempts to deprovision the runner synchronously.
   * This method is primarily for use in the 'beforeunload' handler.
   * It uses a synchronous XMLHttpRequest, which is generally discouraged but necessary
   * in this context due to browser restrictions on asynchronous operations during page unload.
   * Note: This method's success is not guaranteed and may be blocked by browser policies.
   */
  private deprovisionRunnerSync(): void {
    if (!this.currentSessionId) return;
    const url = `${this.orchestratorUrl}/api/runner/deprovision`;
    const payload = JSON.stringify({ sessionId: this.currentSessionId });

    // Using sendBeacon if possible (requires specific content type handling by the server)
    // For now, we stick to a synchronous XHR which is generally discouraged and may not work.
    try {
        const xhr = new XMLHttpRequest();
        // Opening a POST request synchronously
        xhr.open('POST', url, false); // false for synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        // There's no good way to handle the response or errors here in synchronous mode
        xhr.send(payload);
        console.log('Synchronous deprovisioning attempt for session:', this.currentSessionId);
    } catch (e) {
        console.error('Error during synchronous deprovisioning attempt:', e);
    }

    this.currentSessionId = null;
    this.runnerEndpointSubject.next(null);
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
      this.runnerSocket = null;
    }
  }

  /**
   * Sends a generic message to the connected runner instance via Socket.IO.
   *
   * This method can be used by other components or services to send various
   * types of messages or commands to the runner, provided the runner is
   * programmed to handle them.
   *
   * @param eventName The name of the event to emit. This should
   * correspond to an event listener on the runner.
   * @param data The payload to send with the event.
   *
   * @example
   * // Assuming `runnerService` is an injected instance of RunnerService
   * this.runnerService.sendMessage('customEvent', { payload: 'hello runner!' });
   */
  public sendMessage(eventName: string, data: any): void {
    if (this.runnerSocket && this.runnerSocket.connected) {
      this.runnerSocket.emit(eventName, data);
    } else {
      console.error('Runner socket not connected. Cannot send message.');
    }
  }

  /**
   * Provisions a new runner instance via the orchestrator.
   * If a runner is already provisioned and connected, it returns the existing endpoint.
   * If a session ID exists but the socket is not connected, it attempts to deprovision
   * the old session before provisioning a new one.
   * After successful provisioning, it initializes a Socket.IO connection to the new runner and starts a heartbeat.
   * @returns A promise that resolves with the runner's endpoint URL or null if provisioning fails.
   */
  async provisionRunner(): Promise<string | null> {
    if (this.currentSessionId && this.runnerSocket && this.runnerSocket.connected) {
        console.log('Runner already provisioned and connected:', this.runnerEndpointSubject.getValue());
        return this.runnerEndpointSubject.getValue();
    }

    // If there's a session ID but the socket isn't connected, try deprovisioning first.
    if (this.currentSessionId) {
        console.warn('Found existing session ID but socket not connected. Attempting deprovision before new provision.');
        await this.deprovisionRunner().toPromise().catch(err => {
            console.error("Error during deprovisioning before new provision. Continuing with provisioning...", err);
            // Clear local state even if deprovisioning fails to avoid getting stuck
            this.clearRunnerState();
        });
    }

    try {
      // A new session ID will be generated by the orchestrator if not provided,
      // or we can generate one on the client if needed for specific tracking.
      // For now, let the orchestrator handle it.
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        // 'X-Session-Id': this.currentSessionId || undefined // Example if sending a client-generated ID
      });

      const response = await this.http.post<{ message: string, endpoint: string, sessionId: string }>(
        `${this.orchestratorUrl}/api/runner/provision`,
        {}, // Empty body, the orchestrator can generate the session ID
        { headers }
      ).pipe(
        tap(res => console.log('Provisioning response:', res)),
        catchError(err => {
          console.error('Error provisioning runner:', err);
          this.clearRunnerState(); // Clear state on error
          return throwError(() => new Error(`Runner provisioning failed: ${err.message}`));
        })
      ).toPromise();

      if (response && response.endpoint && response.sessionId) {
        this.currentSessionId = response.sessionId;
        this.runnerEndpointSubject.next(response.endpoint);
        this.initializeSocket(response.endpoint);
        this.startHeartbeat(); // Start heartbeat after successful provisioning
        console.log('Runner provisioned successfully:', response.endpoint, 'Session ID:', response.sessionId);
        return response.endpoint;
      } else {
        this.clearRunnerState();
        throw new Error('Invalid response from provisioning server.');
      }
    } catch (error) {
      console.error('Runner provisioning failed:', error);
      this.clearRunnerState();
      return null; // Or throw error
    }
  }

  /**
   * Starts the heartbeat mechanism.
   * Clears any existing heartbeat timer and sets up a new interval to periodically send
   * a heartbeat request to the orchestrator for the current session.
   */
  private startHeartbeat(): void {
    this.clearHeartbeat(); // Clear any previous heartbeat

    if (this.currentSessionId) {
      this.heartbeatIntervalId = setInterval(() => {
        this.sendHeartbeat();
      }, this.HEARTBEAT_INTERVAL_MS);
      console.log(`Heartbeat started for session: ${this.currentSessionId}`);
    }
  }

  /**
   * Sends a heartbeat signal to the orchestrator for the current session.
   * If no session ID exists, or if the heartbeat request fails (e.g., session not found),
   * the heartbeat mechanism is stopped.
   */
  private sendHeartbeat(): void {
    if (!this.currentSessionId) {
      console.warn('Cannot send heartbeat, no current session ID. Stopping heartbeat.');
      this.clearHeartbeat();
      return;
    }

    const sessionId = this.currentSessionId; // Copy to avoid race conditions if state changes
    this.http.post(`${this.orchestratorUrl}/api/runner/heartbeat`, { sessionId })
      .pipe(
        catchError(err => {
          console.error(`Heartbeat failed for session ${sessionId}:`, err);
          // If the session is no longer valid on the orchestrator (e.g., 404 or 400 error), stop the heartbeat.
          if (err.status === 404 || err.status === 400) {
            console.warn(`Stopping heartbeat for session ${sessionId} due to server error: ${err.status}. The session may no longer be valid.`);
            this.clearHeartbeat();
          }
          return throwError(() => err); // Re-throw the error for the observable chain
        })
      )
      .subscribe({
        next: () => console.log(`Heartbeat sent successfully for session: ${sessionId}`),
        // Error is already handled and logged in catchError
      });
  }

  /**
   * Clears the heartbeat interval timer.
   * This stops the periodic sending of heartbeat signals.
   */
  private clearHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
      console.log('Heartbeat stopped.');
    }
  }

  /**
   * Initializes the Socket.IO connection to the runner at the given endpoint.
   * Sets up event listeners for 'connect', 'disconnect', 'connect_error', and 'reconnect_failed'.
   * On successful connection, it sets the runner as ready and calls `setupListeners` for message handling.
   * Handles reconnection failures by attempting to deprovision the runner.
   * @param endpoint The URL of the runner's Socket.IO server.
   */
  private initializeSocket(endpoint: string): void {
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
    }
    // Ensure the endpoint is valid, e.g., starts with http:// or https://
    // Basic check; more robust validation might be needed depending on expected endpoint formats.
    if (!endpoint.startsWith('http')) {
        console.error("Invalid endpoint for socket connection:", endpoint);
        // Depending on policy, could prepend 'http://' or throw an error.
        // For now, assumes orchestrator provides a correct, full URL.
    }
    this.runnerSocket = io(endpoint, {
      reconnectionAttempts: 5, // Number of reconnection attempts
      reconnectionDelay: 1000, // Delay between attempts in ms
      timeout: 10000,
      // transports: ['websocket'] // Optionally forces websocket
    });

    this.runnerSocket.on('connect', () => {
      console.log('Socket.IO connected to runner:', endpoint);
      this.isRunnerReadySubject.next(true);
      this.setupListeners(); // Setup application-specific event listeners
    });

    this.runnerSocket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected from runner:', reason);
      this.isRunnerReadySubject.next(false);
      // Optional: Consider automatic re-provisioning or user notification logic here.
      // Clearing the endpoint subject might be too aggressive if disconnections are temporary and recoverable.
      // this.runnerEndpointSubject.next(null);
    });

    this.runnerSocket.on('connect_error', (error) => {
      console.error("Socket.IO connection error:", error.message);
      // The client will attempt to reconnect automatically based on `reconnectionAttempts`.
      // No need to deprovision on initial connection errors as it might be a transient network issue.
    });

    this.runnerSocket.on('reconnect_failed', () => {
      console.error("Socket.IO reconnection failed after all attempts. Deprovisioning runner.");
      this.isRunnerReadySubject.next(false);
      this.runnerEndpointSubject.next(null); // Runner is no longer accessible
      if (this.currentSessionId) {
        // Attempt to deprovision the runner as a cleanup measure.
        this.deprovisionRunner().subscribe({
          error: (err) => console.error(
              'Deprovisioning failed after reconnection failure. Session ID:', this.currentSessionId, // Log session ID for traceability
              err
            ),
        });
      }
    });
  }

  /**
   * Sets up listeners for custom Socket.IO events from the runner.
   * This includes events for snippet output, errors, directory listings, and file content.
   * Ensures that listeners are cleared before being re-added to prevent duplicates,
   * though in the current flow, this is typically called once per connection.
   */
  private setupListeners(): void {
    if (!this.runnerSocket) {
      console.error('Socket not initialized, cannot set up listeners.');
      return;
    }

    // Clear existing listeners to prevent duplicates if this method is called multiple times
    // on the same socket instance (e.g., on reconnect if not handled by new 'connect' event).
    this.runnerSocket.off('tayloredOutput');
    this.runnerSocket.off('tayloredError');
    this.runnerSocket.off('tayloredRunError');
    this.runnerSocket.off('directoryListing');
    this.runnerSocket.off('fileContent');

    // Listener for directory listing results
    this.runnerSocket.on('directoryListing', (data: { path: string, files: any[] }) => {
      if (data && Array.isArray(data.files) && typeof data.path === 'string') {
        this.directoryListingSubject.next({ path: data.path, files: data.files });
      } else {
        console.error('Received malformed directoryListing data:', data);
      }
    });

    // Listener for file content results
    this.runnerSocket.on('fileContent', (data: FileContent) => {
      if (data && typeof data.path === 'string' && data.content instanceof ArrayBuffer) {
        this.fileContentSubject.next(data);
      } else {
        console.error('Received malformed fileContent data:', data);
      }
    });

    // Listener for standard output from snippets
    this.runnerSocket.on('tayloredOutput', (data: SnippetOutput) => {
      // Validate data structure before emitting
      if (typeof data.id === 'number') {
        this.snippetOutputSubject.next({ id: data.id, output: data.output, error: data.error || undefined });
      } else {
        console.error('Received malformed tayloredOutput data:', data);
      }
    });

    // Listener for general errors from snippets
    this.runnerSocket.on('tayloredError', (data: SnippetOutput) => {
      if (typeof data.id === 'number') {
        this.snippetOutputSubject.next({ id: data.id, error: data.error, output: data.output || undefined });
      } else {
        console.error('Received malformed tayloredError data:', data);
      }
    });

    // Listener for runtime errors during snippet execution
    this.runnerSocket.on('tayloredRunError', (data: SnippetOutput) => {
      if (typeof data.id === 'number') {
        this.snippetOutputSubject.next({ id: data.id, error: data.error, output: data.output || undefined });
      } else {
        console.error('Received malformed tayloredRunError data:', data);
      }
    });
  }

  /**
   * Clears the local state associated with an active runner.
   * This includes stopping the heartbeat, setting the runner as not ready,
   * clearing session ID and endpoint, and disconnecting the Socket.IO client.
   */
  private clearRunnerState(): void {
    this.clearHeartbeat(); // Stop the heartbeat
    this.isRunnerReadySubject.next(false); // Set runner as not ready
    this.currentSessionId = null;
    this.runnerEndpointSubject.next(null);
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
      this.runnerSocket = null;
    }
  }

  /**
   * Deprovisions the currently active runner instance.
   * Sends a request to the orchestrator to terminate the runner associated with the current session ID.
   * Clears the local runner state regardless of the success of the orchestrator call.
   * @returns An observable that completes when the deprovisioning request is sent,
   * or an observable of an error if the request fails. If no session is active, returns
   * an observable that emits an object with a 'No active session' message.
   */
  deprovisionRunner(): Observable<any> {
    this.isRunnerReadySubject.next(false); // Explicitly set runner as not ready at the start of deprovisioning attempt

    if (!this.currentSessionId) {
      console.log('No active session to deprovision.');
      this.clearRunnerState(); // Ensure state is clean even if no session ID was present
      return new BehaviorSubject({ message: 'No active session' }); // Return an observable indicating no action needed
    }

    const sessionId = this.currentSessionId;
    // Clear local state immediately. This assumes that once deprovisioning is initiated,
    // the current session is considered terminated from the client's perspective.
    this.clearRunnerState();

    console.log(`Attempting to deprovision runner for session: ${sessionId}`);
    return this.http.post(`${this.orchestratorUrl}/api/runner/deprovision`, { sessionId } , {
      // Including session ID in headers as well, if required by orchestrator API design
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'X-Session-Id': sessionId })
    }).pipe(
      tap(() => console.log(`Deprovisioning request sent successfully for session: ${sessionId}`)),
      catchError(err => {
        console.error(`Error deprovisioning runner for session ${sessionId}:`, err);
        // Local state has already been cleared. The error is logged and re-thrown for the caller to handle.
        return throwError(() => new Error(`Runner deprovisioning failed for session ${sessionId}: ${err.message}`));
      })
    );
  }

  /**
   * Sends snippet data (XML) to the connected runner for execution via the 'tayloredRun' Socket.IO event.
   * If the runner is not ready, it attempts to provision a new one first.
   * @param xmlData The XML string representing the snippet to execute.
   * @returns A promise that resolves when the snippet has been sent, or rejects if sending fails (e.g., re-provisioning fails).
   */
  public async sendSnippetToRunner(xmlData: string): Promise<void> {
    if (!this.isRunnerReadySubject.getValue()) {
      console.warn('Runner not ready. Attempting to provision a new one...');
      try {
        await this.provisionRunner();
        // After successful provisioning, isRunnerReadySubject should become true
        // via the 'connect' event in initializeSocket. A small delay or check might be needed
        // if the socket connection isn't immediate.
        if (!this.isRunnerReadySubject.getValue()) {
          // If still not ready after provision attempt, throw to indicate failure.
          throw new Error("Runner provisioning attempted but socket not connected.");
        }
      } catch (error) {
        console.error("Re-provisioning failed. Cannot execute snippet.", error);
        // Propagate the error to the caller or handle as appropriate
        return Promise.reject(error);
      }
    }

    // Check again in case provisioning was successful but socket connection is slightly delayed.
    if (this.runnerSocket && this.runnerSocket.connected) {
      this.runnerSocket.emit('tayloredRun', { body: xmlData });
      console.log('Snippet sent to runner via Socket.IO');
    } else {
      console.error("Runner socket not connected. Cannot send snippet. Provisioning may have failed or socket connection is delayed.");
      return Promise.reject(new Error("Runner socket not connected after provisioning attempt."));
    }
  }

  /**
   * Angular lifecycle hook that is called when the service is destroyed.
   * This is crucial for deprovisioning the runner to free up resources on the backend.
   * It removes the 'beforeunload' event listener and attempts to deprovision any active runner.
   */
  ngOnDestroy(): void {
    console.log('RunnerService ngOnDestroy called. Attempting deprovisioning.');
    // Remove event listener to prevent memory leaks and unintended calls on service recreation.
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    // Asynchronous deprovisioning is attempted. Completion is not guaranteed if the application
    // is abruptly terminated (e.g., browser tab closed), but it's best practice to try.
    if (this.currentSessionId) {
      this.deprovisionRunner().subscribe({
        next: () => console.log('Runner deprovisioned successfully on service destroy.'),
        error: (err) => console.error('Error deprovisioning runner on service destroy:', err)
      });
    }
    // Ensure all local state is cleared regardless of deprovisioning success.
    this.clearRunnerState();
  }

  /**
   * Sends a request to the runner to list the contents of a specified directory.
   * The runner should emit a 'directoryListing' event with the results.
   * @param requestedPath The path of the directory to list in the runner's environment.
   */
  public listRunnerDirectory(requestedPath: string): void {
    if (!this.runnerSocket || !this.runnerSocket.connected) {
      console.error('Runner socket not connected. Cannot list directory.');
      // Optionally, emit an error through a subject or throw an error to the caller.
      return;
    }
    this.sendMessage('listDirectory', { path: requestedPath });
  }

  /**
   * Sends a request to the runner to download a specified file.
   * The runner should emit a 'fileContent' event with the file's path and content.
   * @param filePath The path of the file to download from the runner's environment.
   */
  public requestFileDownload(filePath: string): void {
    if (!this.runnerSocket || !this.runnerSocket.connected) {
      console.error('Runner socket not connected. Cannot request file download.');
      // Optionally, emit an error or throw.
      return;
    }
    this.sendMessage('downloadFile', { path: filePath });
  }

  /**
   * Retrieves the current session ID of the active runner.
   * @returns The current session ID as a string, or null if no session is active.
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}