import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms';
import { BOARD, DEFAULT_SETTINGS, GROUPS } from './shared';
import type { ClientToServerEvents, ServerToClientEvents } from './shared';

export interface AppOptions {
  clientOrigin?: string;
  dataDir?: string;
  roomTtlMs?: number;
  /** Skip the static file handler in tests. */
  serveClient?: boolean;
}

export interface BuiltApp {
  app: express.Express;
  server: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  rooms: RoomManager;
  close: () => Promise<void>;
}

/**
 * Builds the HTTP + Socket.IO server without starting it, so tests can run a
 * real server on an ephemeral port and drive it with real socket clients.
 */
export function buildApp(options: AppOptions = {}): BuiltApp {
  const rawOrigin = options.clientOrigin ?? 'http://localhost:5173';
  const corsOrigin: true | string[] =
    rawOrigin.trim() === '*' ? true : rawOrigin.split(',').map((o) => o.trim());

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '32kb' }));

  const server = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  const rooms = new RoomManager(io, {
    dataDir: options.dataDir ?? path.join(__dirname, '..', 'data'),
    roomTtlMs: options.roomTtlMs ?? 45 * 60 * 1000,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime(), ...rooms.stats() });
  });

  /** Lets the join screen tell a wrong code from a full room. */
  app.get('/api/rooms/:code', (req, res) => {
    res.json(rooms.roomSummary(String(req.params.code ?? '').toUpperCase()));
  });

  /** The board is static data; exposing it helps tooling and debugging. */
  app.get('/api/board', (_req, res) => {
    res.json({ board: BOARD, groups: GROUPS, defaults: DEFAULT_SETTINGS });
  });

  if (options.serveClient !== false) {
    const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
    if (fs.existsSync(path.join(clientDist, 'index.html'))) {
      app.use(
        express.static(clientDist, {
          setHeaders(res, filePath) {
            if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
          },
        }),
      );
      // Single page app: anything that is not an API route renders the client.
      app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
      });
      console.log('[web] serving the built client from', clientDist);
    } else {
      app.get('/', (_req, res) => {
        res
          .type('text/plain')
          .send(
            'Skyline Tycoon server is running. Start the Vite dev server, or run "npm run build" to serve the client from here.',
          );
      });
    }
  }

  const close = async (): Promise<void> => {
    rooms.stop();
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return { app, server, io, rooms, close };
}
