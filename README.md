# Skyline Tycoon

A browser-based **3D multiplayer property game** for 2 to 4 players, played in
the fast "world tour" style of Business Tour: claim cities around the world by
building on them, buy your rivals out, host championships, fly anywhere with
World Tour, and win on the spot with a side, triple or resort monopoly.

Create a private room, share a six-character code, fill empty seats with bots
if you like, and play in real time on a bright floating-island board.

- **Rules:** [RULEBOOK.md](RULEBOOK.md)
- **Stack:** React + TypeScript + Vite, Three.js via React Three Fiber,
  Tailwind CSS, Zustand, Node + Express, Socket.IO
- **Authority:** the server owns the game. Dice come from the Node CSPRNG and
  every action is validated server-side - including the bots'.

All artwork is original and drawn in the browser: the island, trees and
buildings are low-poly meshes, the tiles, flags and centre plaque are Canvas 2D
textures, and the four player characters are SVG. Nothing is loaded from the
original game, and its name, logo, characters and art are not used.

**Play it now:** <https://saikrishnamasetti.github.io/skyline-tycoon/>

- **Play online** creates a private room on the game server hosted on Render
  (<https://skyline-tycoon.onrender.com>, which also serves its own copy of
  the game). Share the code or invite link with friends. The free server
  sleeps when idle, so the first visit can take up to a minute to connect.
- **Play solo vs bots** needs no server: the real server modules (rooms,
  rules engine, bots) are bundled into the page and run in your browser. A
  refresh mid-game resumes it.

---

## Quick start

```bash
npm install
npm run dev
```

This runs the game server on <http://localhost:4000> and the Vite dev server on
<http://localhost:5173>. Open the Vite URL, click **Play now**, and share the
room code (or the `/room/CODE` link) with another browser, device or friend.

To play on your own, click **Add a bot** in the lobby for each empty seat.

No configuration is needed: the dev server proxies `/api` and `/socket.io` to
the game server, so the browser stays on one origin exactly as in production.

### Production build

```bash
npm run build
npm start
```

`npm run build` compiles the client to `client/dist` and bundles the server to
`server/dist/index.js`. `npm start` serves the API, the websocket endpoint and
the built client from **one port** (4000 by default).

---

## Requirements

- Node.js 18.17 or newer (developed on Node 24)
- A browser with WebGL 2

---

## Environment variables

Copy `.env.example` to `.env` in the repository root. One file configures both
packages: the server reads it with dotenv, and Vite reads the same directory.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port for HTTP and Socket.IO |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed browser origins, comma separated, or `*` |
| `DATA_DIR` | `./server/data` | Where room snapshots are written |
| `ROOM_TTL_MINUTES` | `45` | How long an abandoned in-progress room is kept |
| `VITE_SERVER_URL` | same origin | Only needed when the client is hosted on another domain |

---

## Project layout

```
skyline-tycoon/
├── shared/src/            TypeScript schema shared by both sides
│   ├── types.ts           GameState, Player, Holding, offers, events, settings
│   ├── board.ts           The 32 spaces, countries, resorts and rent tables
│   ├── cards.ts           The Chance deck
│   ├── rules.ts           Rule helpers used by server AND client
│   ├── protocol.ts        Socket.IO events and the GameAction union
│   └── constants.ts       Defaults, colours, building and buyout rules
├── server/src/
│   ├── index.ts           Entry point: env, listen, graceful shutdown
│   ├── app.ts             Builds the Express + Socket.IO app (testable)
│   ├── rooms.ts           Rooms: join, rejoin, presence, bots, broadcast
│   ├── store.ts           Crash-recovery snapshots on disk
│   ├── util.ts            CSPRNG dice, room codes, input sanitising
│   ├── game/engine.ts     The authoritative rules engine
│   ├── game/bot.ts        The bot players' decision policy
│   └── __tests__/         Engine tests and end-to-end socket tests
└── client/src/
    ├── three/             Scene, TableBase (island), Board, tiles, tokens, dice
    ├── ui/                HUD: player badges, action bar, decision panels, cards
    ├── components/        Lobby, game table, settings, rulebook
    ├── pages/             Landing and Room
    ├── store/useGame.ts   Zustand store; turns events into animations
    ├── net/socket.ts      Typed Socket.IO client and seat persistence
    └── lib/               Board geometry, textures, flags, WebAudio, format
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client together, both watching |
| `npm run build` | Build the client and bundle the server |
| `npm start` | Run the built server (serves the client too) |
| `npm test` | All tests (engine + end-to-end over real sockets) |
| `npm run typecheck` | Typecheck both packages |

---

## How the rules play

The full rules are in [RULEBOOK.md](RULEBOOK.md). In short:

- 32 spaces: Start, Island, Championship and World Tour corners; eight
  countries of two or three real cities; four resorts; three Chance spaces and
  a Tax Office.
- You build when you land: one or two houses to claim an empty city, a third
  after your first lap, then a hotel.
- Pay rent on a rival's city, then buy it out for twice what was built on it.
  Hotels and resorts are safe from buyouts.
- The championship multiplies one city's rent, growing every time.
- World Tour lets you fly to any open city or resort next turn.
- Win instantly with a side, triple or resort monopoly, or be the last solvent
  player, or the richest when the 20-minute clock runs out.

---

## How the multiplayer works

**The server is the only source of truth.** The browser sends intents
(`roll`, `build`, `buyout`, `travel`, `hostChampionship`, `sellProperty`, ...)
and receives the full `GameState` plus a stream of `GameEvent`s that drive
animation, sound and notifications. The client never computes money, rent,
ownership or dice.

**Validation.** Every action goes through `Game.dispatch`, which checks that
the caller is seated, still solvent, owns the decision, and that the room is
in a phase where the action is legal. Costs are re-checked at the moment they
are paid.

**Race conditions.** Node handles one socket message at a time and every
engine method is synchronous, so simultaneous clicks are serialised. Each
mutation bumps `state.version`, and rooms only broadcast real changes.

**Bots.** The host can seat bots in the lobby. They run on the server, decide
with the policy in `server/src/game/bot.ts`, wait a moment between moves so
their play is readable, and go through `Game.dispatch` like everyone else.

**Reconnection.** Joining returns a `sessionToken`, kept in `localStorage`.
On reconnect the client sends it back and reclaims the same seat, so a refresh
never creates a duplicate player.

**Turn clock.** Every decision has a server deadline. When it passes, the
server decides for the player, so nobody can stall the table.

**Persistence.** In-progress rooms are snapshotted to `DATA_DIR` and reloaded
on boot, so a restart or redeploy mid-game is recoverable.

---

## The 3D table

- A floating grass island with low-poly trees and rocks, a wooden board frame
  and a checkered stone centre, lit like a sunny day.
- 32 tiles laid out from one geometry helper (`client/src/lib/layout.ts`)
  shared by the board, tokens and buildings.
- City tiles carry their country's colour and a simplified national flag.
- Houses wear the owner's colour on their roofs; hotels are glass towers.
- A gold multiplier badge floats over the championship city.
- World Tour destinations and championship candidates glow, and you can pick
  them by tapping the board.
- Tokens walk tile by tile; flights and card jumps teleport. Dice settle on
  exactly the faces the server rolled.
- The camera frames the whole board on any screen; orbit, zoom and pan freely
  and recentre with one button.

---

## Testing

```bash
npm test
```

78 tests in two suites:

- **`engine.test.ts`** (59) drives the engine with seeded dice: the board,
  lobby and bots, turn flow, building limits, rent and championship
  multipliers, buyouts, the Island, World Tour, tax, Chance, all three
  monopolies, the match clock, debt and bankruptcy, and complete 2, 3 and
  4-bot games checked for invariants after every move.
- **`multiplayer.test.ts`** (19) starts the real server and connects real
  socket clients: rooms and codes, refused out-of-turn and invalid actions,
  bots seated through the lobby, reconnection without duplicates, and complete
  2, 3 and 4-player games where every client must end with identical state.

---

## Deployment

The build is one Node process that serves everything.

```bash
npm install
npm run build
PORT=8080 CLIENT_ORIGIN='*' DATA_DIR=/var/lib/skyline npm start
```

Make sure WebSockets are enabled on the host, and mount a small persistent
volume at `DATA_DIR` if games should survive a restart.

**Docker**

```bash
docker build -t skyline-tycoon .
docker run -p 4000:4000 -v skyline-data:/data skyline-tycoon
```

**Separate static client:** build with
`VITE_SERVER_URL=https://api.example.com npm run build -w client`, host
`client/dist` with an SPA rewrite for `/room/*`, and run the server with
`CLIENT_ORIGIN` set to the client's origin.

**GitHub Pages + Render:** every push to `main` runs
`.github/workflows/deploy-pages.yml`, which builds the client with
`VITE_LOCAL_MODE=true` (solo games in the browser),
`VITE_SERVER_URL=https://skyline-tycoon.onrender.com` (online rooms) and
`--base=/<repo>/`, copies `index.html` to `404.html` so deep links survive a
refresh, and publishes `client/dist`. In the repository settings, set
**Pages → Source** to **GitHub Actions**.

The server is a free Render web service described by `render.yaml`
(Render → New → Blueprint → this repository). Its `CLIENT_ORIGIN` must list
the Pages origin. Free instances sleep after 15 idle minutes and keep rooms
in memory only. The service was created from the public repository URL, so
server changes need **Manual Deploy** in Render, or connect GitHub in Render
for automatic deploys.

To try the static build locally (solo only, or add `VITE_SERVER_URL`):

```bash
VITE_LOCAL_MODE=true npm run dev -w client
```

**Behind nginx**, forward the upgrade headers:

```nginx
location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
}
```

---

## Not included

Business Tour also has 2v2 team matches, ranked tournaments, leaderboards and
paid power-ups. Those are not part of this game.
