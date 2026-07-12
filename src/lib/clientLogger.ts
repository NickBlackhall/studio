"use client";

/**
 * Mirrors the important parts of the browser console into the client_logs
 * table so gameplay problems can be diagnosed live without asking players
 * to open devtools and copy/paste. Captures console.error/warn plus the
 * app's own emoji-tagged logs; batches inserts every 5s; fails silently.
 */
import { supabase } from './supabaseClient';

const TAGGED = /🔵|🔴|🟡|🎯|🔥|🔄|GAME_PAGE|LOBBY:|SHARED_CONTEXT|HEARTBEAT|ACTION:/;
const MAX_MESSAGE = 1000;
const FLUSH_MS = 5000;
const MAX_BUFFER = 40;

let installed = false;
let buffer: { level: string; message: string }[] = [];
let currentRoomCode: string | null = null;
let currentPlayerName: string | null = null;

const deviceId =
  typeof window !== 'undefined'
    ? (() => {
        try {
          let id = localStorage.getItem('debug_device_id');
          if (!id) {
            id = Math.random().toString(36).slice(2, 8);
            localStorage.setItem('debug_device_id', id);
          }
          return id;
        } catch {
          return 'unknown';
        }
      })()
    : 'server';

export function setLogContext(roomCode: string | null, playerName: string | null) {
  currentRoomCode = roomCode;
  currentPlayerName = playerName;
}

function enqueue(level: string, args: unknown[]) {
  try {
    const message = args
      .map(a => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ')
      .slice(0, MAX_MESSAGE);
    if (level === 'log' && !TAGGED.test(message)) return;
    buffer.push({ level, message });
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  } catch {
    // never let logging break the game
  }
}

async function flush() {
  if (buffer.length === 0) return;
  const rows = buffer.map(b => ({
    room_code: currentRoomCode,
    player_name: currentPlayerName,
    device_id: deviceId,
    level: b.level,
    message: b.message,
  }));
  buffer = [];
  try {
    // (cast: generated DB types predate the client_logs diagnostics table)
    await (supabase.from as CallableFunction)('client_logs').insert(rows);
  } catch {
    // drop on failure — diagnostics must never affect gameplay
  }
}

export function installClientLogger() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => {
    enqueue('log', args);
    original.log(...args);
  };
  console.warn = (...args: unknown[]) => {
    enqueue('warn', args);
    original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    enqueue('error', args);
    original.error(...args);
  };

  window.addEventListener('error', e => enqueue('error', [`window.onerror: ${e.message}`]));
  window.addEventListener('unhandledrejection', e =>
    enqueue('error', [`unhandledrejection: ${String((e as PromiseRejectionEvent).reason).slice(0, 300)}`])
  );

  setInterval(flush, FLUSH_MS);
  window.addEventListener('beforeunload', () => {
    void flush();
  });
}
