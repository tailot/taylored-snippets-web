import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client'; // Using official socket.io-client

/**
 * RunnerService is a root-provided Angular service responsible for managing
 * the lifecycle of and communication with a dedicated `runner.js` instance.
 * This service handles provisioning (requesting a new runner instance from an
 * orchestrator), deprovisioning (terminating the runner instance), and sending
 * messages or snippets to the runner via Socket.IO. It also listens for
 * output and errors from the runner.
 */
@Injectable({
  providedIn: 'root'
})
export class RunnerService implements OnDestroy {
  private orchestratorUrl = 'http://localhost:3001'; // Assuming orchestrator runs here

  private runnerEndpointSubject = new BehaviorSubject<string | null>(null);
  public runnerEndpoint$: Observable<string | null> = this.runnerEndpointSubject.asObservable();

  private currentSessionId: string | null = null;
  private runnerSocket: Socket | null = null;

  constructor(private http: HttpClient) {
    // Attempt to deprovision if the window is closed or page is refreshed
    // This is not foolproof but can help in some scenarios.
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Standard way to prompt user before leaving, but we use it to deprovision
    if (this.currentSessionId) {
      // Note: Most browsers will not guarantee asynchronous operations (like HTTP requests)
      // in 'beforeunload'. navigator.sendBeacon is preferred for telemetry but not suitable for all POSTs.
      // This call might not complete successfully.
      // A more robust solution involves backend session timeouts for runners.
      this.deprovisionRunnerSync();
    }
  };

  // Synchronous deprovisioning attempt for beforeunload
  // WARNING: This is a best-effort attempt and might be blocked by browsers.
  // navigator.sendBeacon would be better if the server could accept GET or application/x-www-form-urlencoded
  private deprovisionRunnerSync(): void {
    if (!this.currentSessionId) return;
    const url = `${this.orchestratorUrl}/api/runner/deprovision`;
    const payload = JSON.stringify({ sessionId: this.currentSessionId });

    // Using sendBeacon if possible (requires specific server handling for content type)
    // For now, we'll stick to a synchronous XHR which is generally discouraged and may not work.
    try {
        const xhr = new XMLHttpRequest();
        // Opening a POST request synchronously
        xhr.open('POST', url, false); // false for synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        // No good way to handle response or errors here in sync mode
        xhr.send(payload);
        console.log('Attempted synchronous deprovision for session:', this.currentSessionId);
    } catch (e) {
        console.error('Error attempting synchronous deprovision:', e);
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
   * @param {string} eventName The name of the event to emit. This should
   *                           correspond to an event listener on the runner.
   * @param {any} data The payload to send with the event.
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
   * Provisions a new runner instance through the orchestrator.
   * If a runner is already provisioned and connected, it returns the existing endpoint.
   * If a session ID exists but the socket is not connected, it attempts to deprovision
   * the old session before provisioning a new one.
   * Upon successful provisioning, it initializes a Socket.IO connection to the new runner.
   * @returns {Promise<string | null>} A promise that resolves with the runner endpoint URL or null if provisioning fails.
   */
  async provisionRunner(): Promise<string | null> {
    if (this.currentSessionId && this.runnerSocket && this.runnerSocket.connected) {
        console.log('Runner already provisioned and connected:', this.runnerEndpointSubject.getValue());
        return this.runnerEndpointSubject.getValue();
    }

    // If there's a session ID but socket is not connected, try to deprovision first.
    if (this.currentSessionId) {
        console.warn('Found existing session ID but socket not connected. Attempting to deprovision before reprovisioning.');
        await this.deprovisionRunner().toPromise().catch(err => {
            console.error('Error during deprovision before reprovisioning. Continuing with provisioning...', err);
            // Clear local state even if deprovision fails to avoid getting stuck
            this.clearRunnerState();
        });
    }

    try {
      // A new session ID will be generated by the orchestrator if not provided,
      // or we can generate one on the client if needed for specific tracking.
      // For now, let orchestrator handle it or use existing one if any.
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        // 'X-Session-Id': this.currentSessionId || undefined // Example if sending client-generated ID
      });

      const response = await this.http.post<{ message: string, endpoint: string, sessionId: string }>(
        `${this.orchestratorUrl}/api/runner/provision`,
        {}, // Empty body, orchestrator can generate session ID
        { headers }
      ).pipe(
        tap(res => console.log('Provisioning response:', res)),
        catchError(err => {
          console.error('Error during runner provisioning:', err);
          this.clearRunnerState(); // Clear state on error
          return throwError(() => new Error(`Failed to provision runner: ${err.message}`));
        })
      ).toPromise();

      if (response && response.endpoint && response.sessionId) {
        this.currentSessionId = response.sessionId;
        this.runnerEndpointSubject.next(response.endpoint);
        this.initializeSocket(response.endpoint);
        console.log('Runner provisioned successfully:', response.endpoint, 'Session ID:', response.sessionId);
        return response.endpoint;
      } else {
        this.clearRunnerState();
        throw new Error('Invalid response from provisioning server.');
      }
    } catch (error) {
      console.error('Failed to provision runner:', error);
      this.clearRunnerState();
      return null; // Or throw error
    }
  }

  private initializeSocket(endpoint: string): void {
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
    }
    // Ensure endpoint is valid, e.g., starts with http:// or https://
    if (!endpoint.startsWith('http')) {
        console.error('Invalid endpoint for socket connection:', endpoint);
        // Potentially prepend default http if missing, or handle error
        // For now, we assume it's correct from orchestrator
    }
    this.runnerSocket = io(endpoint, {
      reconnectionAttempts: 3,
      timeout: 10000,
      // transports: ['websocket'] // Optionally force websocket
    });

    this.runnerSocket.on('connect', () => {
      console.log('Socket.IO connected to runner:', endpoint);
    });

    this.runnerSocket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected from runner:', reason);
      // Optionally try to reprovision or notify user
      // this.runnerEndpointSubject.next(null); // Consider if this is desired on disconnect
    });

    this.runnerSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      this.runnerEndpointSubject.next(null); // Clear endpoint on connection error
      // Potentially try to deprovision this session as it's unusable
      if(this.currentSessionId) {
          this.deprovisionRunner().subscribe({
              error: err => console.error("Failed to deprovision after connection error", err)
          });
      }
    });
  }

  private clearRunnerState(): void {
    this.currentSessionId = null;
    this.runnerEndpointSubject.next(null);
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
      this.runnerSocket = null;
    }
  }

  /**
   * Deprovisions the currently active runner instance.
   * It sends a request to the orchestrator to terminate the runner associated with the current session ID.
   * Clears local runner state regardless of whether the orchestrator call succeeds.
   * @returns {Observable<any>} An observable that completes when the deprovisioning request is sent,
   * or an observable of an error if the request fails. If no session is active, it returns
   * an observable that emits an object with a message 'No active session'.
   */
  deprovisionRunner(): Observable<any> {
    if (!this.currentSessionId) {
      console.log('No active session to deprovision.');
      this.clearRunnerState();
      return new BehaviorSubject({ message: 'No active session' }); // Return an observable
    }

    const sessionId = this.currentSessionId;
    // Clear local state immediately, assuming deprovision will succeed or fail cleanly.
    this.clearRunnerState();

    console.log(`Attempting to deprovision runner for session: ${sessionId}`);
    return this.http.post(`${this.orchestratorUrl}/api/runner/deprovision`, { sessionId } , {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'X-Session-Id': sessionId })
    }).pipe(
      tap(() => console.log(`Deprovisioning request sent for session: ${sessionId}`)),
      catchError(err => {
        console.error(`Error deprovisioning runner for session ${sessionId}:`, err);
        // Even if deprovision fails on server, local state is already cleared.
        return throwError(() => new Error(`Failed to deprovision runner: ${err.message}`));
      })
    );
  }

  /**
   * Sends snippet data (XML) to the connected runner for execution.
   * The runner should be set up to listen for the 'tayloredRun' event.
   * @param {string} xmlData The XML string representing the snippet to be executed.
   */
  sendSnippetToRunner(xmlData: string): void {
    if (this.runnerSocket && this.runnerSocket.connected) {
      this.runnerSocket.emit('tayloredRun', { body: xmlData });
      console.log('Snippet sent to runner via Socket.IO');
    } else {
      console.error('Runner socket not connected. Cannot send snippet.');
      // Optionally try to provision again or notify user
      // this.provisionRunner(); // Be careful with automatic re-provisioning loops
    }
  }

  /**
   * Listens for 'tayloredOutput' events from the runner.
   * These events are expected to carry the output or results of snippet execution.
   * @returns {Observable<any>} An observable that emits data received from the 'tayloredOutput' event.
   * Throws an error if the socket is not initialized.
   */
  listenForRunnerOutput(): Observable<any> {
    if (!this.runnerSocket) {
      // Return an empty observable or throw error if socket not initialized
      return throwError(() => new Error('Runner socket not initialized for listening to output.'));
    }
    return new Observable(observer => {
      this.runnerSocket?.on('tayloredOutput', (data) => {
        observer.next(data);
      });
      // Cleanup when unsubscribed
      return () => this.runnerSocket?.off('tayloredOutput');
    });
  }

  /**
   * Listens for 'tayloredRunError' events from the runner.
   * These events are expected to carry error information from snippet execution.
   * @returns {Observable<any>} An observable that emits data received from the 'tayloredRunError' event.
   * Throws an error if the socket is not initialized.
   */
  listenForRunnerError(): Observable<any> {
    if (!this.runnerSocket) {
      return throwError(() => new Error('Runner socket not initialized for listening to errors.'));
    }
    return new Observable(observer => {
      this.runnerSocket?.on('tayloredRunError', (data) => {
        observer.next(data);
      });
      // Cleanup when unsubscribed
      return () => this.runnerSocket?.off('tayloredRunError');
    });
  }

  /**
   * Lifecycle hook that cleans up when the service is destroyed.
   * This is crucial for deprovisioning the runner to free up resources.
   * It removes the 'beforeunload' event listener and attempts to deprovision the runner.
   */
  ngOnDestroy(): void {
    console.log('RunnerService ngOnDestroy called. Attempting deprovision.');
    // Remove the event listener to prevent memory leaks
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    // Use the async deprovision and subscribe to it.
    // ngOnDestroy can handle async if needed, but completion isn't guaranteed if app is force-closed.
    if (this.currentSessionId) {
      this.deprovisionRunner().subscribe({
        next: () => console.log('Deprovisioned runner on service destroy.'),
        error: (err) => console.error('Error deprovisioning runner on service destroy:', err)
      });
    }
    this.clearRunnerState(); // Ensure socket is disconnected and state is cleared
  }
}