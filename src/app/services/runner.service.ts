import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client'; // Using official socket.io-client

export interface SnippetOutput {
  id: number;
  output?: string;
  error?: string;
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
  private orchestratorUrl = 'http://localhost:3001'; // Supponendo che l'orchestratore sia in esecuzione qui

  private runnerEndpointSubject = new BehaviorSubject<string | null>(null);
  public runnerEndpoint$: Observable<string | null> = this.runnerEndpointSubject.asObservable();

  private snippetOutputSubject = new Subject<SnippetOutput>();
  public snippetOutput$: Observable<SnippetOutput> = this.snippetOutputSubject.asObservable();

  private isRunnerReadySubject = new BehaviorSubject<boolean>(false);
  public isRunnerReady$: Observable<boolean> = this.isRunnerReadySubject.asObservable();

  private currentSessionId: string | null = null;
  private runnerSocket: Socket | null = null;

  constructor(private http: HttpClient) {
    // Attempt to deprovision if the window is closed or the page is refreshed
    // This is not foolproof but can help in some scenarios.
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

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

  // Synchronous deprovisioning attempt for beforeunload
  // WARNING: This is a "best-effort" attempt and may be blocked by browsers.
  // navigator.sendBeacon would be better if the server could accept GET or application/x-www-form-urlencoded
  private deprovisionRunnerSync(): void {
    if (!this.currentSessionId) return;
    const url = `${this.orchestratorUrl}/api/runner/deprovision`;
    const payload = JSON.stringify({ sessionId: this.currentSessionId });

    // Using sendBeacon if possible (requires specific content type handling by the server)
    // For now, we stick to a synchronous XHR which is generally discouraged and may not work.
    try {
        const xhr = new XMLHttpRequest();
        // Opening a POST request synchronously
        xhr.open('POST', url, false); // false per sincrono
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
   * @param {string} eventName The name of the event to emit. This should
   * correspond to an event listener on the runner.
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
   * Provisions a new runner instance via the orchestrator.
   * If a runner is already provisioned and connected, it returns the existing endpoint.
   * If a session ID exists but the socket is not connected, it attempts to deprovision
   * the old session before provisioning a new one.
   * After successful provisioning, it initializes a Socket.IO connection to the new runner.
   * @returns {Promise<string | null>} A promise that resolves with the runner's endpoint URL or null if provisioning fails.
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
        {}, // Body vuoto, l'orchestratore può generare l'ID di sessione
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

  private initializeSocket(endpoint: string): void {
    if (this.runnerSocket) {
      this.runnerSocket.disconnect();
    }
    // Ensure the endpoint is valid, e.g., starts with http:// or https://
    if (!endpoint.startsWith('http')) {
        console.error("Invalid endpoint for socket connection:", endpoint);
        // Potentially prepend http by default if missing, or handle the error
        // For now, assume it's correct from the orchestrator
    }
    this.runnerSocket = io(endpoint, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      // transports: ['websocket'] // Opzionalmente forza websocket
    });

    this.runnerSocket.on('connect', () => {
      console.log('Socket.IO connected to runner:', endpoint);
      this.isRunnerReadySubject.next(true);
      this.setupListeners();
    });

    this.runnerSocket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected from runner:', reason);
      this.isRunnerReadySubject.next(false);
      // Optionally try to re-provision or notify the user
      // this.runnerEndpointSubject.next(null); // Consider if this is desired on disconnect
    });

    this.runnerSocket.on('connect_error', (error) => {
      console.error("Socket.IO connection error:", error.message);
      // Don't deprovision on first error, let the client retry.
    });

    this.runnerSocket.on('reconnect_failed', () => {
      console.error("Socket.IO reconnection failed. Deprovisioning runner.");
      this.isRunnerReadySubject.next(false);
      this.runnerEndpointSubject.next(null);
      if (this.currentSessionId) {
        this.deprovisionRunner().subscribe({
          error: (err) => console.error(
              'Deprovisioning failed after reconnection failure',
              err
            ),
        });
      }
    });
  }

  private setupListeners(): void {
    if (!this.runnerSocket) {
      console.error('Socket not initialized, cannot set up listeners.');
      return;
    }

    // Clear existing listeners before adding new ones to prevent duplicates
    // if this method could be called multiple times on the same socket instance.
    // In the current design, it's called once on 'connect'.
    this.runnerSocket.off('tayloredOutput');
    this.runnerSocket.off('tayloredError');
    this.runnerSocket.off('tayloredRunError');

    this.runnerSocket.on('tayloredOutput', (data: SnippetOutput) => {
      // Ensure data conforms to SnippetOutput
      this.snippetOutputSubject.next({ id: data.id, output: data.output, error: data.error || undefined });
    });

    this.runnerSocket.on('tayloredError', (data: SnippetOutput) => {
       // Ensure data conforms to SnippetOutput
      this.snippetOutputSubject.next({ id: data.id, error: data.error, output: data.output || undefined });
    });

    this.runnerSocket.on('tayloredRunError', (data: SnippetOutput) => {
      // Ensure data conforms to SnippetOutput
      this.snippetOutputSubject.next({ id: data.id, error: data.error, output: data.output || undefined });
    });
  }

  private clearRunnerState(): void {
    this.isRunnerReadySubject.next(false); // Also set runner as not ready
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
   * @returns {Observable<any>} An observable that completes when the deprovisioning request is sent,
   * or an observable of an error if the request fails. If no session is active, returns
   * an observable that emits an object with a 'No active session' message.
   */
  deprovisionRunner(): Observable<any> {
    this.isRunnerReadySubject.next(false); // Explicitly set runner as not ready

    if (!this.currentSessionId) {
      console.log('No active session to deprovision.');
      this.clearRunnerState(); // This will also call isRunnerReadySubject.next(false)
      return new BehaviorSubject({ message: 'No active session' }); // Return an observable
    }

    const sessionId = this.currentSessionId;
    // Clear local state immediately, assuming deprovisioning will succeed or fail cleanly.
    this.clearRunnerState();

    console.log(`Attempting to deprovision runner for session: ${sessionId}`);
    return this.http.post(`${this.orchestratorUrl}/api/runner/deprovision`, { sessionId } , {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'X-Session-Id': sessionId })
    }).pipe(
      tap(() => console.log(`Deprovisioning request sent for session: ${sessionId}`)),
      catchError(err => {
        console.error(`Error deprovisioning runner for session ${sessionId}:`, err);
        // Even if deprovisioning fails on the server, local state has already been cleared.
        return throwError(() => new Error(`Runner deprovisioning failed: ${err.message}`));
      })
    );
  }

  /**
   * Sends snippet data (XML) to the connected runner for execution.
   * The runner should be set up to listen for the 'tayloredRun' event.
   * @param {string} xmlData The XML string representing the snippet to execute.
   */
  public async sendSnippetToRunner(xmlData: string): Promise<void> {
    if (!this.isRunnerReadySubject.getValue()) {
      console.warn('Runner not ready. Attempting to provision a new one...');
      try {
        await this.provisionRunner();
        // After successful provisioning, isRunnerReadySubject should be true via initializeSocket's 'connect' event.
        // However, if provisionRunner resolves but the socket doesn't connect immediately,
        // isRunnerReadySubject might still be false here. The check below will handle it.
      } catch (error) {
        console.error("Re-provisioning failed. Cannot execute snippet.", error);
        return;
      }
    }

    if (this.runnerSocket && this.runnerSocket.connected) {
      this.runnerSocket.emit('tayloredRun', { body: xmlData });
      console.log('Snippet sent to runner via Socket.IO');
    } else {
      // This case handles if provisioning was attempted but the socket is not yet connected.
      console.error("Runner socket not connected. Cannot send snippet. Provisioning may have failed or socket connection is delayed.");
    }
  }

  /**
   * Lifecycle hook that cleans up when the service is destroyed.
   * This is crucial for deprovisioning the runner to free up resources.
   * Removes the 'beforeunload' event listener and attempts to deprovision the runner.
   */
  ngOnDestroy(): void {
    console.log('RunnerService ngOnDestroy called. Attempting deprovisioning.');
    // Remove event listener to prevent memory leaks
    window.removeEventListener('beforeunload', this.handleBeforeUnload);

    // Use asynchronous deprovisioning and subscribe.
    // ngOnDestroy can handle async if needed, but completion is not guaranteed if the app is forcibly closed.
    if (this.currentSessionId) {
      this.deprovisionRunner().subscribe({
        next: () => console.log('Runner deprovisioned on service destroy.'),
        error: (err) => console.error('Error deprovisioning runner on service destroy:', err)
      });
    }
    this.clearRunnerState(); // Ensure socket is disconnected and state is cleared
  }
}