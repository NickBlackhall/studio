// Polyfill WebSocket for Node.js (required for Realtime subscriptions)
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;

// Increase default timeout & add one retry for realtime-heavy specs
jest.setTimeout(45_000);
jest.retryTimes(1, { logErrorsBeforeRetry: true });

// Polyfill WHATWG APIs for Next server imports (Node 20 still okay to be explicit)
const { fetch, Headers, Request, Response, FormData, File, Blob } = require('undici');
globalThis.fetch = fetch;
globalThis.Headers = Headers;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.FormData = FormData;
globalThis.File = File;
globalThis.Blob = Blob;

// AbortController & URLPattern (belt-and-suspenders)
require('urlpattern-polyfill');
if (!globalThis.AbortController) {
  const { AbortController } = require('abort-controller');
  globalThis.AbortController = AbortController;
}

// Mock next/cache revalidatePath (edge-adjacent import found in actions.ts)
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));