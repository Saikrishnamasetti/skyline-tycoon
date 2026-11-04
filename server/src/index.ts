import path from 'path';
import dotenv from 'dotenv';
import { buildApp } from './app';

// A server-local .env wins; the repo-root .env fills in the rest.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const DATA_DIR = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '..', 'data'));
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MINUTES ?? 45) * 60 * 1000;

const { server, close } = buildApp({
  clientOrigin: CLIENT_ORIGIN,
  dataDir: DATA_DIR,
  roomTtlMs: ROOM_TTL_MS,
});

server.listen(PORT, () => {
  console.log(`[server] Skyline Tycoon listening on http://localhost:${PORT}`);
  console.log(`[server] allowed origins: ${CLIENT_ORIGIN}`);
  console.log(`[server] room snapshots in ${DATA_DIR}`);
});

function shutdown(signal: string): void {
  console.log(`\n[server] ${signal} received, saving rooms...`);
  void close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
