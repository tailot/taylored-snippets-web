import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core'; // Added
import { RunnerService } from './runner.service';
import * as socketIoClientModule from 'socket.io-client'; // Import the module itself

// Mock the socket.io-client library
// The actual 'io' function will be replaced by this mock.
// We need to be able to mock the 'on', 'emit', 'disconnect', 'connect' methods of the socket instance.
const mockSocket = {
  on: jasmine.createSpy('on'),
  emit: jasmine.createSpy('emit'),
  disconnect: jasmine.createSpy('disconnect'),
  connect: jasmine.createSpy('connect'),
  connected: false, // Default to not connected
};

// let ioSpy: jasmine.Spy; // Removed: ioSpy is problematic due to ES module read-only bindings

describe('RunnerService', () => {
  let service: RunnerService;
  let httpMock: HttpTestingController;
  let consoleErrorSpy: jasmine.Spy;
  const orchestratorUrl = 'http://localhost:3001'; // As defined in the service

  beforeEach(() => {
    // Removed: ioSpy = spyOn(socketIoClientModule, 'io').and.returnValue(mockSocket as any);
    // This was causing "not declared writable or has no setter" error.
    // We will spy on service's 'initializeSocket' method in relevant tests instead.

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        RunnerService,
        provideZonelessChangeDetection() // Added for consistency with app config
      ],
    });
    service = TestBed.inject(RunnerService);
    httpMock = TestBed.inject(HttpTestingController);
    consoleErrorSpy = spyOn(console, 'error').and.callFake(() => {}); // Suppress console.error

    // Reset spies and mockSocket state
    mockSocket.on.calls.reset();
    mockSocket.emit.calls.reset();
    mockSocket.disconnect.calls.reset();
    mockSocket.connect.calls.reset();
    mockSocket.connected = false; // Ensure connected state is reset
    // ioSpy.calls.reset(); // Removed
    consoleErrorSpy.calls.reset();
  });

  afterEach(() => {
    if (httpMock) { // Guard against httpMock being undefined if beforeEach failed
      httpMock.verify(); // Make sure that there are no outstanding requests
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sendMessage', () => {
    it('should emit message if socket is connected', () => {
      // Simulate a connected socket
      (service as any).runnerSocket = mockSocket;
      mockSocket.connected = true;

      const eventName = 'testEvent';
      const data = { message: 'hello' };
      service.sendMessage(eventName, data);

      expect(mockSocket.emit).toHaveBeenCalledWith(eventName, data);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log an error if socket is not connected', () => {
      (service as any).runnerSocket = mockSocket;
      mockSocket.connected = false; // Ensure it's not connected

      service.sendMessage('testEvent', { message: 'hello' });

      expect(mockSocket.emit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Runner socket not connected. Cannot send message.');
    });

    it('should log an error if socket is null', () => {
      (service as any).runnerSocket = null; // Socket is not initialized

      service.sendMessage('testEvent', { message: 'hello' });

      expect(mockSocket.emit).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Runner socket not connected. Cannot send message.');
    });
  });

  describe('provisionRunner', () => {
    const mockProvisionResponse = {
      message: 'Runner provisioned',
      endpoint: 'http://runner-endpoint:4000',
      sessionId: 'test-session-123',
    };

    let initializeSocketSpy: jasmine.Spy;

    it('should provision a new runner, initialize socket, and update subjects', async () => {
      // Ensure no existing session
      (service as any).currentSessionId = null;
      (service as any).runnerSocket = null;

      initializeSocketSpy = spyOn(service as any, 'initializeSocket').and.callFake((endpointParam: string) => {
        // Simulate that initializeSocket sets up the runnerSocket
        expect(endpointParam).toBe(mockProvisionResponse.endpoint);
        (service as any).runnerSocket = mockSocket;
        // The real initializeSocket would also call mockSocket.on(...).
        // For this test, we focus on provisionRunner's orchestration.
      });

      const provisionPromise = service.provisionRunner();

      const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      expect(req.request.method).toBe('POST');
      req.flush(mockProvisionResponse);
      const endpoint = await provisionPromise;

      expect(endpoint).toBe(mockProvisionResponse.endpoint);
      expect((service as any).currentSessionId).toBe(mockProvisionResponse.sessionId);
      expect((service as any).runnerEndpointSubject.getValue()).toBe(mockProvisionResponse.endpoint);

      expect(initializeSocketSpy).toHaveBeenCalledWith(mockProvisionResponse.endpoint);
      expect((service as any).runnerSocket).toBe(mockSocket); // Ensure the service's socket is our mock
      // Assertions for mockSocket.on calls are removed as the faked initializeSocket
      // doesn't replicate that part unless explicitly coded, which is not the focus here.
    });

    it('should return existing endpoint if already provisioned and connected', async () => {
      const existingEndpoint = 'http://existing-runner:3000';
      (service as any).currentSessionId = 'existing-session-id';
      (service as any).runnerSocket = mockSocket;
      mockSocket.connected = true;
      (service as any).runnerEndpointSubject.next(existingEndpoint);
      initializeSocketSpy = spyOn(service as any, 'initializeSocket');

      const endpoint = await service.provisionRunner();

      expect(endpoint).toBe(existingEndpoint);
      httpMock.expectNone(`${orchestratorUrl}/api/runner/provision`); // No HTTP call
      expect(initializeSocketSpy).not.toHaveBeenCalled(); // No new socket initialization
    });

     it('should deprovision if session exists but socket not connected, then reprovision', async () => {
      (service as any).currentSessionId = 'old-session-id';
      (service as any).runnerSocket = null; // or mockSocket.connected = false;

      // Mock deprovision call
      initializeSocketSpy = spyOn(service as any, 'initializeSocket').and.callFake((endpoint: string) => {
        (service as any).runnerSocket = mockSocket;
      });

      const provisionPromise = service.provisionRunner();
      const deprovisionReq = httpMock.expectOne(`${orchestratorUrl}/api/runner/deprovision`);
      expect(deprovisionReq.request.method).toBe('POST');
      expect(deprovisionReq.request.body).toEqual({ sessionId: 'old-session-id' });
      deprovisionReq.flush({ message: 'Deprovisioned successfully' });

      // Allow the event loop to process, ensuring the async provisionRunner
      // makes the subsequent HTTP call and it's seen by HttpTestingController.
      await new Promise(resolve => setTimeout(resolve, 0));
      // Mock provision call
      const provisionReq = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      expect(provisionReq.request.method).toBe('POST');
      provisionReq.flush(mockProvisionResponse);

      const endpoint = await provisionPromise;
      expect(endpoint).toBe(mockProvisionResponse.endpoint);
      expect((service as any).currentSessionId).toBe(mockProvisionResponse.sessionId);
      expect(initializeSocketSpy).toHaveBeenCalledTimes(1); // initializeSocket for the new provisioning
    });


    it('should handle provisioning failure', async () => {
      (service as any).currentSessionId = null;
      (service as any).runnerSocket = null;

      initializeSocketSpy = spyOn(service as any, 'initializeSocket');

      const provisionPromise = service.provisionRunner();

      const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      req.flush({ message: 'Failed to provision' }, { status: 500, statusText: 'Server Error' });

      const endpoint = await provisionPromise;

      expect(endpoint).toBeNull();
      expect((service as any).currentSessionId).toBeNull();
      expect((service as any).runnerEndpointSubject.getValue()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Runner provisioning failed:', jasmine.any(Error));
      expect(initializeSocketSpy).not.toHaveBeenCalled();
    });
  });

  describe('deprovisionRunner', () => {
    it('should send deprovision request and clear runner state if session exists', (done) => {
      const sessionId = 'test-session-deprovision';
      (service as any).currentSessionId = sessionId;
      (service as any).runnerSocket = mockSocket; // Assign a mock socket
      (service as any).runnerEndpointSubject.next('http://some-endpoint');


      service.deprovisionRunner().subscribe({
        next: (response) => {
          expect(response).toBeDefined();
          expect((service as any).currentSessionId).toBeNull();
          expect((service as any).runnerEndpointSubject.getValue()).toBeNull();
          expect((service as any).runnerSocket).toBeNull(); // runnerSocket should be cleared
          done();
        },
        error: (err) => done.fail(err)
      });

      const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/deprovision`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ sessionId });
      req.flush({ message: 'Deprovisioned successfully' });
    });

    it('should clear state and return observable if no active session', (done) => {
      (service as any).currentSessionId = null;
      (service as any).runnerSocket = mockSocket; // Simulate it was there
      (service as any).runnerEndpointSubject.next('http://some-endpoint');


      service.deprovisionRunner().subscribe({
        next: (response: any) => {
          expect(response.message).toBe('No active session');
          expect((service as any).currentSessionId).toBeNull();
          expect((service as any).runnerEndpointSubject.getValue()).toBeNull();
          expect((service as any).runnerSocket).toBeNull();
          done();
        },
        error: (err) => done.fail(err)
      });

      httpMock.expectNone(`${orchestratorUrl}/api/runner/deprovision`);
    });

    it('should handle deprovisioning failure but still clear local state', (done) => {
        const sessionId = 'test-session-fail-deprovision';
        (service as any).currentSessionId = sessionId;
        (service as any).runnerSocket = mockSocket;
        (service as any).runnerEndpointSubject.next('http://some-endpoint');

        service.deprovisionRunner().subscribe({
            next: () => done.fail('Should have failed'),
            error: (error) => {
                expect(error).toBeTruthy();
                expect((service as any).currentSessionId).toBeNull();
                expect((service as any).runnerEndpointSubject.getValue()).toBeNull();
                expect((service as any).runnerSocket).toBeNull();
                expect(consoleErrorSpy).toHaveBeenCalledWith(`Error deprovisioning runner for session ${sessionId}:`, jasmine.any(HttpErrorResponse));
                done();
            }
        });

        const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/deprovision`);
        req.flush({ message: 'Failed to deprovision' }, { status: 500, statusText: 'Server Error' });
    });
  });

  // TODO: Add tests for listenForRunnerOutput, listenForRunnerError, ngOnDestroy, handleBeforeUnload, deprovisionRunnerSync
});
