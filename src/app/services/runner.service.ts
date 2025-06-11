import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError, of, from } from 'rxjs';
import { catchError, tap, switchMap, map } from 'rxjs/operators';
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
  /** Getter to check if the runner socket is currently connected. */
  private get isSocketConnected(): boolean {
    return !!this.runnerSocket && this.runnerSocket.connected;
  }

  public sendMessage(eventName: string, data: any): void {
    if (this.isSocketConnected) {
      this.runnerSocket!.emit(eventName, data); // Safe to use ! due to isSocketConnected check
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
   * @returns An Observable that emits the runner's endpoint URL or null if provisioning fails.
   */
  provisionRunner(): Observable<string | null> {
    if (this.currentSessionId && this.runnerSocket && this.runnerSocket.connected) {
      console.log('Runner already provisioned and connected:', this.runnerEndpointSubject.getValue());
      return of(this.runnerEndpointSubject.getValue());
    }

    const deprovisionIfNeeded$ = this.currentSessionId
      ? from(this.deprovisionRunner().toPromise().catch(err => {
          console.error("Error during deprovisioning before new provision. Continuing with provisioning...", err);
          this.clearRunnerState(); // Clear local state even if deprovisioning fails
        }))
      : of(null); // No deprovisioning needed

    return deprovisionIfNeeded$.pipe(
      switchMap(() => {
        const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
        return this.http.post<{ message: string, endpoint: string, sessionId: string }>(
          `${this.orchestratorUrl}/api/runner/provision`,
          {}, // Empty body
          { headers }
        ).pipe(
          tap(res => console.log('Provisioning response:', res)),
          map(response => {
            if (response && response.endpoint && response.sessionId) {
              this.currentSessionId = response.sessionId;
              this.runnerEndpointSubject.next(response.endpoint);
              this.initializeSocket(response.endpoint);
              this.startHeartbeat();
              console.log('Runner provisioned successfully:', response.endpoint, 'Session ID:', response.sessionId);
              return response.endpoint;
            } else {
              this.clearRunnerState();
              // console.error('Invalid response from provisioning server.'); // Handled by handleHttpError
              throw new Error('Invalid response from provisioning server.'); // This error will be caught by catchError
            }
          }),
          catchError(err => this.handleHttpError(err, 'Runner provisioning'))
        );
      }),
      catchError(error => { // Catch errors from deprovisionIfNeeded$ or the main provisioning flow
        // This catchError is for the entire chain, including potential errors from deprovisionIfNeeded$
        // or if the map operator above throws an error not caught by its own catchError.
        console.error('Runner provisioning failed overall:', error.message || error);
        this.clearRunnerState(); // Ensure state is cleared on any provisioning failure path
        return of(null); // Return null Observable on failure
      })
    );
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
          if (err.status === 404 || err.status === 400) {
            console.warn(`Stopping heartbeat for session ${sessionId} due to server error: ${err.status}. The session may no longer be valid.`);
            this.clearHeartbeat(); // Specific action for heartbeat failure
          }
          // Use handleHttpError for logging and re-throwing
          return this.handleHttpError(err, `Heartbeat for session ${sessionId}`);
        })
      )
      .subscribe({
        next: () => console.log(`Heartbeat sent successfully for session: ${sessionId}`),
        // Error is handled by the catchError and logged by handleHttpError
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
    this.runnerSocket.on('tayloredOutput', (data: SnippetOutput) =>
      this.handleSnippetEvent(data, 'tayloredOutput')
    );

    // Listener for general errors from snippets
    this.runnerSocket.on('tayloredError', (data: SnippetOutput) =>
      this.handleSnippetEvent(data, 'tayloredError')
    );

    // Listener for runtime errors during snippet execution
    this.runnerSocket.on('tayloredRunError', (data: SnippetOutput) =>
      this.handleSnippetEvent(data, 'tayloredRunError')
    );
  }

  /**
   * Handles incoming snippet-related events from Socket.IO.
   * Validates the data and pushes it to the snippetOutputSubject.
   * @param data The data received from the socket event.
   * @param eventName The name of the event (for logging).
   */
  private handleSnippetEvent(data: SnippetOutput, eventName: string): void {
    if (data && typeof data.id === 'number') {
      // Ensure error and output are at least undefined if not present
      this.snippetOutputSubject.next({
        id: data.id,
        output: data.output || undefined,
        error: data.error || undefined
      });
    } else {
      console.error(`Received malformed ${eventName} data:`, data);
    }
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
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'X-Session-Id': sessionId })
    }).pipe(
      tap(() => console.log(`Deprovisioning request sent successfully for session: ${sessionId}`)),
      catchError(err => this.handleHttpError(err, `Runner deprovisioning for session ${sessionId}`))
    );
  }

  /**
   * Handles HTTP errors by logging them and returning a new error observable.
   * @param error The error object.
   * @param context A string describing the context of the error.
   * @returns An Observable that throws an error.
   */
  private handleHttpError(error: any, context: string): Observable<never> {
    const errorMessage = error.message || (error.error instanceof Error ? error.error.message : (typeof error.error === 'string' ? error.error : 'Server error'));
    console.error(`Error in ${context}:`, errorMessage, 'Full error:', error);
    // Additional state clearing or specific actions can be done here if common to all HTTP errors
    // For example, if any HTTP error should always clear runner state: this.clearRunnerState();
    // However, clearRunnerState() is already called in provisionRunner's higher-level catchError.
    // For deprovision and heartbeat, clearing state is handled more specifically.
    return throwError(() => new Error(`${context} failed: ${errorMessage}`));
  }

  /**
   * Sends snippet data (XML) to the connected runner for execution via the 'tayloredRun' Socket.IO event.
   * If the runner is not ready, it attempts to provision a new one first.
   * @param xmlData The XML string representing the snippet to execute.
   * @returns An Observable that completes when the snippet has been sent, or errors if sending fails.
   */
  public sendSnippetToRunner(xmlData: string): Observable<void> {
    const provisionIfNeeded$: Observable<any> = !this.isRunnerReadySubject.getValue()
      ? this.provisionRunner().pipe(
          tap(() => {
            if (!this.isRunnerReadySubject.getValue()) {
              console.error("Runner provisioning attempted but socket not connected.");
              throw new Error("Runner provisioning attempted but socket not connected.");
            }
          }),
          catchError(error => {
            console.error("Re-provisioning failed. Cannot execute snippet.", error);
            // Errors from provisionRunner are already handled by its own catchError and handleHttpError
            return throwError(() => error);
          })
        )
      : of(null); // No provisioning needed

    return provisionIfNeeded$.pipe(
      switchMap(() => {
        // isRunnerReadySubject should be true here if provisionIfNeeded succeeded
        if (this.isSocketConnected) {
          this.runnerSocket!.emit('tayloredRun', { body: xmlData }); // Safe to use !
          console.log('Snippet sent to runner via Socket.IO');
          return of(undefined); // Indicate success (void)
        } else {
          // This case should ideally be caught by the isRunnerReadySubject check after provisioning
          const errorMsg = "Runner socket not connected despite provisioning attempt.";
          console.error(errorMsg);
          return throwError(() => new Error(errorMsg));
        }
      })
    );
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
    if (!this.isSocketConnected) {
      console.error('Runner socket not connected. Cannot list directory.');
      // Optionally, emit an error through a subject or throw an error to the caller.
      return;
    }
    // sendMessage already checks for socket connection, but good practice to check before calling
    this.runnerSocket!.emit('listDirectory', { path: requestedPath });
  }

  /**
   * Sends a request to the runner to download a specified file.
   * The runner should emit a 'fileContent' event with the file's path and content.
   * @param filePath The path of the file to download from the runner's environment.
   */
  public requestFileDownload(filePath: string): void {
    if (!this.isSocketConnected) {
      console.error('Runner socket not connected. Cannot request file download.');
      // Optionally, emit an error or throw.
      return;
    }
    // sendMessage already checks for socket connection
    this.runnerSocket!.emit('downloadFile', { path: filePath });
  }

  /**
   * Retrieves the current session ID of the active runner.
   * @returns The current session ID as a string, or null if no session is active.
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}