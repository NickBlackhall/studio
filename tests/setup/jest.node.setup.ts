// Polyfill WebSocket for Node.js (required for Realtime subscriptions)
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;

// Increase default timeout & add one retry for realtime-heavy specs
jest.setTimeout(45_000);
jest.retryTimes(1, { logErrorsBeforeRetry: true });

// Polyfill WHATWG APIs for Next server imports (Node 20 still okay to be explicit)
const { fetch, Headers, Request, Response, FormData, File, Blob } = require('undici');
(globalThis as any).fetch = fetch;
(globalThis as any).Headers = Headers;
(globalThis as any).Request = Request;
(globalThis as any).Response = Response;
(globalThis as any).FormData = FormData;
(globalThis as any).File = File;
(globalThis as any).Blob = Blob;

// AbortController & URLPattern (belt-and-suspenders)
require('urlpattern-polyfill');
if (!globalThis.AbortController) {
  const { AbortController } = require('abort-controller');
  globalThis.AbortController = AbortController;
}

// Mock next/cache revalidatePath (edge-adjacent import found in actions.ts)
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));