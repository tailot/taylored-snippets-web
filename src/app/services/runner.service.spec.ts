import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RunnerService } from './runner.service';
import { io } from 'socket.io-client';

// Mock the socket.io-client library
// The actual 'io' function will be replaced by this mock.
// We need to be able to mock the 'on', 'emit', 'disconnect', 'connect' methods of the socket instance.
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn(),
  connected: false, // Default to not connected
};

// Mock the io function to return our mockSocket
// and provide a way to access the mockSocket instance for assertions.
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));


describe('RunnerService', () => {
  let service: RunnerService;
  let httpMock: HttpTestingController;
  let consoleErrorSpy: jest.SpyInstance;

  const orchestratorUrl = 'http://localhost:3001'; // As defined in the service

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RunnerService],
    });
    service = TestBed.inject(RunnerService);
    httpMock = TestBed.inject(HttpTestingController);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error

    // Reset mocks before each test
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connect.mockClear();
    (io as jest.Mock).mockClear(); // Clear the mock on 'io' itself
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    httpMock.verify(); // Make sure that there are no outstanding requests
    consoleErrorSpy.mockRestore(); // Restore console.error
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

    it('should provision a new runner, initialize socket, and update subjects', async () => {
      // Ensure no existing session
      (service as any).currentSessionId = null;
      (service as any).runnerSocket = null;

      const provisionPromise = service.provisionRunner();

      const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      expect(req.request.method).toBe('POST');
      req.flush(mockProvisionResponse);

      const endpoint = await provisionPromise;

      expect(endpoint).toBe(mockProvisionResponse.endpoint);
      expect((service as any).currentSessionId).toBe(mockProvisionResponse.sessionId);
      expect((service as any).runnerEndpointSubject.getValue()).toBe(mockProvisionResponse.endpoint);

      // Check that io was called with the new endpoint
      expect(io).toHaveBeenCalledWith(mockProvisionResponse.endpoint, expect.any(Object));
      expect((service as any).runnerSocket).toBe(mockSocket); // Ensure the service's socket is our mock

      // Check socket event listeners were attached
      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('should return existing endpoint if already provisioned and connected', async () => {
      const existingEndpoint = 'http://existing-runner:3000';
      (service as any).currentSessionId = 'existing-session-id';
      (service as any).runnerSocket = mockSocket;
      mockSocket.connected = true;
      (service as any).runnerEndpointSubject.next(existingEndpoint);

      const endpoint = await service.provisionRunner();

      expect(endpoint).toBe(existingEndpoint);
      httpMock.expectNone(`${orchestratorUrl}/api/runner/provision`); // No HTTP call
      expect(io).not.toHaveBeenCalled(); // No new socket initialization
    });

     it('should deprovision if session exists but socket not connected, then reprovision', async () => {
      (service as any).currentSessionId = 'old-session-id';
      (service as any).runnerSocket = null; // or mockSocket.connected = false;

      // Mock deprovision call
      const deprovisionPromise = service.provisionRunner();
      const deprovisionReq = httpMock.expectOne(`${orchestratorUrl}/api/runner/deprovision`);
      expect(deprovisionReq.request.method).toBe('POST');
      expect(deprovisionReq.request.body).toEqual({ sessionId: 'old-session-id' });
      deprovisionReq.flush({ message: 'Deprovisioned successfully' });

      // Mock provision call
      const provisionReq = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      expect(provisionReq.request.method).toBe('POST');
      provisionReq.flush(mockProvisionResponse);

      const endpoint = await deprovisionPromise;
      expect(endpoint).toBe(mockProvisionResponse.endpoint);
      expect((service as any).currentSessionId).toBe(mockProvisionResponse.sessionId);
       expect(io).toHaveBeenCalledTimes(1); // io should be called once for the new provisioning
    });


    it('should handle provisioning failure', async () => {
      (service as any).currentSessionId = null;
      (service as any).runnerSocket = null;

      const provisionPromise = service.provisionRunner();

      const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/provision`);
      req.flush({ message: 'Failed to provision' }, { status: 500, statusText: 'Server Error' });

      const endpoint = await provisionPromise;

      expect(endpoint).toBeNull();
      expect((service as any).currentSessionId).toBeNull();
      expect((service as any).runnerEndpointSubject.getValue()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to provision runner:', expect.any(Error));
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
                expect(consoleErrorSpy).toHaveBeenCalledWith(`Error deprovisioning runner for session ${sessionId}:`, expect.any(Error));
                done();
            }
        });

        const req = httpMock.expectOne(`${orchestratorUrl}/api/runner/deprovision`);
        req.flush({ message: 'Failed to deprovision' }, { status: 500, statusText: 'Server Error' });
    });
  });

  // TODO: Add tests for listenForRunnerOutput, listenForRunnerError, ngOnDestroy, handleBeforeUnload, deprovisionRunnerSync
});
