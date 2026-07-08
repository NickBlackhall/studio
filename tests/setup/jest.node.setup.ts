// Make this file a module so its top-level consts don't collide with the
// global DOM lib declarations (WebSocket, fetch, TextEncoder, ...)
export {};

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

// Polyfill TextEncoder/TextDecoder for jose JWT library
const { TextEncoder, TextDecoder } = require('util');
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

// Polyfill structuredClone for jose JWT library
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// AbortController & URLPattern (belt-and-suspenders)
require('urlpattern-polyfill');
if (!globalThis.AbortController) {
  const { AbortController } = require('abort-controller');
  globalThis.AbortController = AbortController;
}

// Mock next/cache revalidatePath (edge-adjacent import found in actions.ts)
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

// Mock next/headers cookies() with an in-memory store. The real cookies()
// only works inside a request scope, which Jest tests don't have — without
// this, every session helper (src/lib/auth.ts) throws.
//
// Concurrency: some actions are self-only (e.g. togglePlayerReadyStatus), so
// tests that fire concurrent calls for different players each need their own
// cookie jar, like separate browsers. runWithCookieScope() gives the wrapped
// async call an isolated store via AsyncLocalStorage; everything else shares
// the global store.
import { AsyncLocalStorage } from 'async_hooks';
type MockCookie = { name: string; value: string };
const mockCookieAls = new AsyncLocalStorage<Map<string, MockCookie>>();
const mockGlobalCookies = new Map<string, MockCookie>();
const mockActiveCookies = () => mockCookieAls.getStore() ?? mockGlobalCookies;
jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => mockActiveCookies().get(name),
    getAll: () => Array.from(mockActiveCookies().values()),
    has: (name: string) => mockActiveCookies().has(name),
    set: (name: string, value: string, _options?: unknown) => {
      mockActiveCookies().set(name, { name, value });
    },
    delete: (name: string) => {
      mockActiveCookies().delete(name);
    },
  }),
}));

(globalThis as any).__runWithCookieScope = <T,>(fn: () => Promise<T>): Promise<T> =>
  mockCookieAls.run(new Map(), fn);

// Fresh cookie state per test so sessions don't leak between tests
beforeEach(() => mockGlobalCookies.clear());