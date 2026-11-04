import {
  BOARD_SIZE,
  BOT_NAMES,
  CARD_BY_ID,
  CHANCE_DECK,
  DEFAULT_SETTINGS,
  HOTEL_LEVEL,
  ISLAND_INDEX,
  MAX_LOG_ENTRIES,
  OWNABLE_INDEXES,
  RESORT_INDEXES,
  WIN_LABEL,
  activePlayers,
  buildOptions,
  canBuyout,
  canTransfer,
  currentPlayerId,
  findPlayer,
  formatMoney,
  netWorth,
  playerHoldings,
  propertyValue,
  rentFor,
  sellValue,
  taxDue,
  tileAt,
  winCheck,
} from '../shared';
import type {
  Ack,
  Card,
  GameAction,
  GameEvent,
  GameSettings,
  GameState,
  Holding,
  Identity,
  LogKind,
  Player,
  PlayerColorId,
  TokenShape,
  TradeOffer,
  WinReason,
} from '../shared';
import { clamp, isInteger, newId, rollDie, sanitizeName, shuffle } from '../util';

const okRes: Ack = { ok: true };
const errRes = (error: string): Ack => ({ ok: false, error });

/** How deep a chain of card moves may go before we stop resolving landings. */
const MAX_CARD_DEPTH = 2;

export function createInitialState(
  roomCode: string,
  settings: GameSettings = DEFAULT_SETTINGS,
): GameState {
  const holdings: Record<number, Holding> = {};
  for (const index of OWNABLE_INDEXES) holdings[index] = { owner: null, level: 0 };
  return {
    roomCode,
    status: 'lobby',
    hostId: '',
    settings: { ...settings },
    players: [],
    order: [],
    currentIndex: 0,
    turnCount: 0,
    phase: 'lobby',
    dice: null,
    rollId: 0,
    doublesCount: 0,
    lastDoubles: false,
    holdings,
    championship: { tile: null, level: 0 },
    buildOffer: null,
    buyoutOffer: null,
    championshipOffer: null,
    pendingDebt: null,
    trades: [],
    deck: shuffle(CHANCE_DECK.map((c) => c.id)),
    lastCard: null,
    log: [],
    deadline: null,
    startedAt: null,
    endsAt: null,
    winnerId: null,
    winReason: null,
    version: 0,
    createdAt: Date.now(),
  };
}

/**
 * The single source of truth for one table. Every mutation goes through a
 * method here, and every method validates its caller first, so a client can
 * never push the room into a state the rules do not allow.
 */
export class Game {
  state: GameState;
  private pending: GameEvent[] = [];
  private logSeq = 0;

  constructor(state: GameState) {
    this.state = state;
    this.logSeq = state.log.reduce((max, entry) => Math.max(max, entry.id), 0);
  }

  static create(roomCode: string, settings?: Partial<GameSettings>): Game {
    const game = new Game(createInitialState(roomCode, DEFAULT_SETTINGS));
    if (settings) game.applySettings(settings);
    return game;
  }

  /* ----------------------------------------------------------- plumbing */

  drainEvents(): GameEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private emit(event: GameEvent): void {
    this.pending.push(event);
  }

  private log(text: string, kind: LogKind = 'system', playerId?: string): void {
    this.state.log.push({ id: ++this.logSeq, ts: Date.now(), text, kind, playerId });
    if (this.state.log.length > MAX_LOG_ENTRIES) {
      this.state.log.splice(0, this.state.log.length - MAX_LOG_ENTRIES);
    }
  }

  private bump(): void {
    this.state.version++;
  }

  private player(id: string): Player | undefined {
    return findPlayer(this.state, id);
  }

  get currentId(): string | null {
    return currentPlayerId(this.state);
  }

  private get current(): Player | undefined {
    const id = this.currentId;
    return id ? this.player(id) : undefined;
  }

  private name(id: string | null | undefined): string {
    if (!id) return 'The bank';
    return this.player(id)?.name ?? 'A player';
  }

  private setPhase(phase: GameState['phase'], seconds?: number): void {
    this.state.phase = phase;
    this.state.deadline = seconds && seconds > 0 ? Date.now() + seconds * 1000 : null;
  }

  private get playing(): boolean {
    return this.state.status === 'playing';
  }

  /* -------------------------------------------------------------- lobby */

  get isFull(): boolean {
    return this.state.players.length >= this.state.settings.maxPlayers;
  }

  private freeColor(preferred?: PlayerColorId): PlayerColorId {
    const all: PlayerColorId[] = ['cobalt', 'coral', 'mint', 'amber'];
    const taken = new Set(this.state.players.map((p) => p.color));
    if (preferred && !taken.has(preferred)) return preferred;
    return all.find((c) => !taken.has(c)) ?? 'cobalt';
  }

  private freeToken(preferred?: TokenShape): TokenShape {
    const all: TokenShape[] = ['tower', 'spire', 'dome', 'prism'];
    const taken = new Set(this.state.players.map((p) => p.token));
    if (preferred && !taken.has(preferred)) return preferred;
    return all.find((t) => !taken.has(t)) ?? 'tower';
  }

  private freshPlayerFields(): Pick<
    Player,
    | 'cash'
    | 'position'
    | 'laps'
    | 'onIsland'
    | 'islandTurns'
    | 'escapeCards'
    | 'shieldCards'
    | 'travelPending'
    | 'bankrupt'
  > {
    return {
      cash: this.state.settings.startingCash,
      position: 0,
      laps: 0,
      onIsland: false,
      islandTurns: 0,
      escapeCards: 0,
      shieldCards: 0,
      travelPending: false,
      bankrupt: false,
    };
  }

  addPlayer(identity: Identity, isBot = false): { ok: boolean; error?: string; playerId?: string } {
    if (this.state.status !== 'lobby') return { ok: false, error: 'That game has already started' };
    if (this.isFull) return { ok: false, error: 'That room is full' };

    const player: Player = {
      id: newId(),
      name: sanitizeName(identity?.name, `Player ${this.state.players.length + 1}`),
      color: this.freeColor(identity?.color),
      token: this.freeToken(identity?.token),
      seat: this.state.players.length,
      ...this.freshPlayerFields(),
      isBot,
      connected: true,
      ready: isBot,
      joinedAt: Date.now(),
    };
    this.state.players.push(player);
    if (!this.state.hostId && !isBot) this.state.hostId = player.id;
    this.log(`${player.name} ${isBot ? 'takes a seat' : 'joined the room'}.`, 'system', player.id);
    this.bump();
    return { ok: true, playerId: player.id };
  }

  addBot(requesterId: string): Ack {
    if (requesterId !== this.state.hostId) return errRes('Only the host can add bots');
    if (this.state.status !== 'lobby') return errRes('The game already started');
    if (this.isFull) return errRes('The table is full');
    const taken = new Set(this.state.players.map((p) => p.name));
    const base = BOT_NAMES.find((n) => !taken.has(`${n} (Bot)`)) ?? 'Bot';
    const added = this.addPlayer({ name: `${base} (Bot)`, color: 'cobalt', token: 'tower' }, true);
    return added.ok ? okRes : errRes(added.error ?? 'Could not add a bot');
  }

  removeBot(requesterId: string, botId: string): Ack {
    if (requesterId !== this.state.hostId) return errRes('Only the host can remove bots');
    if (this.state.status !== 'lobby') return errRes('The game already started');
    const bot = this.player(botId);
    if (!bot || !bot.isBot) return errRes('That seat is not a bot');
    return this.removePlayer(botId);
  }

  removePlayer(playerId: string): Ack {
    const index = this.state.players.findIndex((p) => p.id === playerId);
    if (index < 0) return errRes('Unknown player');
    const [player] = this.state.players.splice(index, 1);
    this.state.players.forEach((p, i) => {
      p.seat = i;
    });
    this.log(`${player.name} left the room.`, 'system');
    if (this.state.hostId === playerId) {
      this.state.hostId = this.state.players.find((p) => !p.isBot)?.id ?? '';
    }
    this.bump();
    return okRes;
  }

  setConnected(playerId: string, connected: boolean): void {
    const player = this.player(playerId);
    if (!player || player.isBot || player.connected === connected) return;
    player.connected = connected;
    this.log(`${player.name} ${connected ? 'reconnected' : 'lost connection'}.`, 'system', playerId);
    if (!connected && this.state.status === 'lobby') {
      player.ready = false;
      if (this.state.hostId === playerId) {
        const next = this.state.players.find((p) => p.connected && !p.isBot && p.id !== playerId);
        if (next) this.state.hostId = next.id;
      }
    }
    this.bump();
  }

  setReady(playerId: string, ready: boolean): Ack {
    if (this.state.status !== 'lobby') return errRes('The game already started');
    const player = this.player(playerId);
    if (!player) return errRes('Unknown player');
    player.ready = !!ready;
    this.bump();
    return okRes;
  }

  setIdentity(playerId: string, identity: Partial<Identity>): Ack {
    if (this.state.status !== 'lobby') return errRes('The game already started');
    const player = this.player(playerId);
    if (!player) return errRes('Unknown player');
    if (typeof identity.name === 'string') player.name = sanitizeName(identity.name, player.name);
    if (identity.color) {
      if (this.state.players.some((p) => p.id !== playerId && p.color === identity.color)) {
        return errRes('That colour is taken');
      }
      player.color = identity.color;
    }
    if (identity.token) {
      if (this.state.players.some((p) => p.id !== playerId && p.token === identity.token)) {
        return errRes('That piece is taken');
      }
      player.token = identity.token;
    }
    this.bump();
    return okRes;
  }

  /** Clamp and apply a settings patch. Used by the host and at creation. */
  private applySettings(patch: Partial<GameSettings>): void {
    const s = this.state.settings;
    if (isInteger(patch.maxPlayers)) {
      s.maxPlayers = clamp(patch.maxPlayers, Math.max(2, this.state.players.length), 4);
    }
    if (isInteger(patch.startingCash)) s.startingCash = clamp(patch.startingCash, 1_000_000, 5_000_000);
    if (isInteger(patch.salary)) s.salary = clamp(patch.salary, 100_000, 600_000);
    if (isInteger(patch.islandFee)) s.islandFee = clamp(patch.islandFee, 0, 1_000_000);
    if (isInteger(patch.worldTourFee)) s.worldTourFee = clamp(patch.worldTourFee, 0, 500_000);
    if (isInteger(patch.turnSeconds)) s.turnSeconds = clamp(patch.turnSeconds, 15, 90);
    if (isInteger(patch.debtSeconds)) s.debtSeconds = clamp(patch.debtSeconds, 20, 180);
    if (isInteger(patch.matchMinutes)) s.matchMinutes = clamp(patch.matchMinutes, 0, 60);
    if (typeof patch.tradingEnabled === 'boolean') s.tradingEnabled = patch.tradingEnabled;
    for (const p of this.state.players) p.cash = s.startingCash;
  }

  updateSettings(playerId: string, patch: Partial<GameSettings>): Ack {
    if (playerId !== this.state.hostId) return errRes('Only the host can change setup');
    if (this.state.status !== 'lobby') return errRes('The game already started');
    this.applySettings(patch ?? {});
    this.bump();
    return okRes;
  }

  start(playerId: string): Ack {
    if (playerId !== this.state.hostId) return errRes('Only the host can start the game');
    if (this.state.status !== 'lobby') return errRes('The game already started');
    if (this.state.players.length < 2) return errRes('At least two tycoons are needed');
    const notReady = this.state.players.filter((p) => p.id !== this.state.hostId && !p.ready);
    if (notReady.length > 0) return errRes('Everyone has to be ready first');

    this.state.order = shuffle(this.state.players.map((p) => p.id));
    for (const p of this.state.players) {
      Object.assign(p, this.freshPlayerFields());
      p.seat = this.state.order.indexOf(p.id);
    }
    const now = Date.now();
    this.state.status = 'playing';
    this.state.currentIndex = 0;
    this.state.turnCount = 1;
    this.state.startedAt = now;
    this.state.endsAt =
      this.state.settings.matchMinutes > 0 ? now + this.state.settings.matchMinutes * 60_000 : null;
    this.state.deck = shuffle(CHANCE_DECK.map((c) => c.id));
    this.log('The tour begins. Build your empire.', 'system');
    const firstId = this.state.order[0];
    this.log(`${this.name(firstId)} goes first.`, 'system', firstId);
    this.emit({ t: 'turn', playerId: firstId });
    this.setPhase('pre_roll', this.state.settings.turnSeconds);
    this.bump();
    return okRes;
  }

  /** Back to a fresh lobby with everyone still seated. */
  rematch(playerId: string): Ack {
    if (playerId !== this.state.hostId) return errRes('Only the host can restart');
    if (this.state.status !== 'finished') return errRes('Finish this game first');
    const fresh = createInitialState(this.state.roomCode, this.state.settings);
    fresh.hostId = this.state.hostId;
    fresh.players = this.state.players.map((p, i) => ({
      ...p,
      ...this.freshPlayerFields(),
      seat: i,
      ready: p.isBot || p.id === this.state.hostId,
    }));
    this.state = fresh;
    this.logSeq = 0;
    this.log('The host called a rematch.', 'system');
    this.bump();
    return okRes;
  }

  /* -------------------------------------------------------------- money */

  private credit(playerId: string, amount: number, reason: string): void {
    const player = this.player(playerId);
    if (!player || amount <= 0) return;
    player.cash += amount;
    this.emit({ t: 'cash', playerId, amount, reason });
  }

  /** Moves money that is known to be available. */
  private settle(debtorId: string, amount: number, creditorId: string | null, reason: string): void {
    const debtor = this.player(debtorId);
    if (!debtor || amount <= 0) return;
    debtor.cash -= amount;
    this.emit({ t: 'cash', playerId: debtorId, amount: -amount, reason });
    if (creditorId) this.credit(creditorId, amount, reason);
  }

  /**
   * Charge the current player. Returns true when paid outright; otherwise the
   * room enters the in-debt phase and they must sell to raise the money.
   */
  private charge(
    debtorId: string,
    amount: number,
    creditorId: string | null,
    reason: string,
    distribute?: { playerIds: string[]; each: number },
  ): boolean {
    const debtor = this.player(debtorId);
    if (!debtor || amount <= 0) return true;
    if (debtor.cash >= amount) {
      if (distribute) {
        for (const id of distribute.playerIds) this.settle(debtorId, distribute.each, id, reason);
      } else {
        this.settle(debtorId, amount, creditorId, reason);
      }
      return true;
    }
    this.state.pendingDebt = { debtorId, creditorId, amount, reason, distribute };
    this.setPhase('in_debt', this.state.settings.debtSeconds);
    this.log(`${debtor.name} owes ${formatMoney(amount)} and must sell to cover it.`, 'danger', debtorId);
    return false;
  }

  /** Sell a holding back to the bank for half of what was built on it. */
  private sellInternal(playerId: string, index: number): number {
    const holding = this.state.holdings[index];
    const amount = sellValue(this.state, index);
    holding.owner = null;
    holding.level = 0;
    this.credit(playerId, amount, `Sold ${tileAt(index).name}`);
    this.emit({ t: 'sell', playerId, tile: index, amount });
    this.log(`${this.name(playerId)} sells ${tileAt(index).name} for ${formatMoney(amount)}.`, 'property', playerId);
    return amount;
  }

  /** Sell the cheapest holdings first until the target is in hand. */
  private autoLiquidate(playerId: string, target: number): void {
    const player = this.player(playerId);
    if (!player) return;
    while (player.cash < target) {
      const holdings = playerHoldings(this.state, playerId).sort(
        (a, b) => sellValue(this.state, a) - sellValue(this.state, b),
      );
      if (holdings.length === 0) break;
      this.sellInternal(playerId, holdings[0]);
    }
  }

  /**
   * A rival pays the current player immediately (Chance cards). They sell to
   * the bank if they must, and go bankrupt to the current player if that is
   * still not enough. The current player's turn is not affected.
   */
  private forcePay(debtorId: string, amount: number, creditorId: string, reason: string): void {
    const debtor = this.player(debtorId);
    if (!debtor || debtor.bankrupt || amount <= 0) return;
    if (debtor.cash < amount) this.autoLiquidate(debtorId, amount);
    if (debtor.cash >= amount) {
      this.settle(debtorId, amount, creditorId, reason);
      return;
    }
    this.bankruptTo(debtorId, creditorId);
  }

  /* ----------------------------------------------------------- movement */

  private advanceTo(
    playerId: string,
    target: number,
    opts: { collectSalary: boolean; steps?: number; jump: boolean },
  ): void {
    const player = this.player(playerId);
    if (!player) return;
    const from = player.position;
    const to = ((target % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
    const steps = opts.steps ?? (to - from + BOARD_SIZE) % BOARD_SIZE;
    const passedStart = opts.collectSalary && steps > 0 && from + steps >= BOARD_SIZE;
    player.position = to;
    this.emit({ t: 'move', playerId, from, to, steps, passedStart, jump: opts.jump });
    if (passedStart) {
      player.laps += 1;
      this.credit(playerId, this.state.settings.salary, 'Salary');
      this.log(
        `${player.name} passes Start and collects ${formatMoney(this.state.settings.salary)}.`,
        'money',
        playerId,
      );
    }
  }

  private sendToIsland(playerId: string, reason: string): void {
    const player = this.player(playerId);
    if (!player) return;
    if (player.position !== ISLAND_INDEX) {
      this.emit({
        t: 'move',
        playerId,
        from: player.position,
        to: ISLAND_INDEX,
        steps: 0,
        passedStart: false,
        jump: true,
      });
    }
    player.position = ISLAND_INDEX;
    player.onIsland = true;
    player.islandTurns = 0;
    player.travelPending = false;
    this.state.doublesCount = 0;
    this.state.lastDoubles = false;
    this.emit({ t: 'island', playerId, reason });
    this.log(`${player.name} is stranded on the Island. ${reason}`, 'island', playerId);
  }

  private releaseFromIsland(playerId: string, how: string): void {
    const player = this.player(playerId);
    if (!player) return;
    player.onIsland = false;
    player.islandTurns = 0;
    this.emit({ t: 'free', playerId, how });
  }

  /* ------------------------------------------------------------ landing */

  private resolveLanding(playerId: string, depth = 0): void {
    const player = this.player(playerId);
    if (!player || player.bankrupt || !this.playing) return;
    const tile = tileAt(player.position);

    switch (tile.kind) {
      case 'start':
        this.log(`${player.name} lands on Start.`, 'system', playerId);
        break;
      case 'city':
      case 'resort':
        this.resolveProperty(playerId);
        break;
      case 'chance':
        this.drawCard(playerId, depth);
        break;
      case 'tax': {
        const due = taxDue(this.state, playerId);
        if (due > 0) {
          this.log(`${player.name} owes the Tax Office ${formatMoney(due)}.`, 'money', playerId);
          this.charge(playerId, due, null, 'Tax Office');
        } else {
          this.log(`${player.name} owns nothing to tax.`, 'money', playerId);
        }
        break;
      }
      case 'island':
        this.sendToIsland(playerId, 'Washed ashore.');
        break;
      case 'championship':
        this.offerChampionship(playerId);
        break;
      case 'worldtour':
        player.travelPending = true;
        this.state.lastDoubles = false;
        this.log(`${player.name} reaches World Tour and can fly anywhere next turn.`, 'system', playerId);
        break;
    }
  }

  private resolveProperty(playerId: string): void {
    const player = this.player(playerId)!;
    const index = player.position;
    const tile = tileAt(index);
    const holding = this.state.holdings[index];

    if (!holding.owner || holding.owner === playerId) {
      this.offerBuild(playerId, index, holding.owner ? 'upgrade' : 'buy');
      return;
    }

    const ownerId = holding.owner;
    const rent = rentFor(this.state, index);
    if (rent <= 0) return;

    if (player.shieldCards > 0) {
      player.shieldCards -= 1;
      this.state.deck.push('shield');
      this.emit({ t: 'rent', fromId: playerId, toId: ownerId, amount: 0, tile: index, shielded: true });
      this.log(`${player.name} shows a diplomatic pass and pays no rent in ${tile.name}.`, 'card', playerId);
      this.offerBuyout(playerId, index);
      return;
    }

    this.log(`${player.name} pays ${this.name(ownerId)} ${formatMoney(rent)} in ${tile.name}.`, 'money', playerId);
    this.emit({ t: 'rent', fromId: playerId, toId: ownerId, amount: rent, tile: index, shielded: false });
    if (this.charge(playerId, rent, ownerId, `Rent in ${tile.name}`)) {
      this.offerBuyout(playerId, index);
    }
  }

  private offerBuild(playerId: string, index: number, mode: 'buy' | 'upgrade'): void {
    const player = this.player(playerId)!;
    const options = buildOptions(this.state, playerId, index);
    if (options.length === 0) return;
    if (player.cash < options[0].cost) {
      this.log(`${player.name} cannot afford to build in ${tileAt(index).name}.`, 'property', playerId);
      return;
    }
    this.state.buildOffer = {
      playerId,
      tile: index,
      mode,
      currentLevel: this.state.holdings[index].level,
      options,
    };
    this.setPhase('build', this.state.settings.turnSeconds);
  }

  private offerBuyout(playerId: string, index: number): void {
    const holding = this.state.holdings[index];
    const check = canBuyout(this.state, playerId, index);
    if (!check.ok || !holding.owner) return;
    this.state.buyoutOffer = { playerId, tile: index, fromId: holding.owner, price: check.cost };
    this.setPhase('buyout', this.state.settings.turnSeconds);
  }

  private offerChampionship(playerId: string): void {
    const ownsCity = playerHoldings(this.state, playerId).some((i) => tileAt(i).kind === 'city');
    if (!ownsCity) {
      this.log(`${this.name(playerId)} has no city to host a championship.`, 'system', playerId);
      return;
    }
    this.state.championshipOffer = { playerId };
    this.setPhase('championship', this.state.settings.turnSeconds);
  }

  /* --------------------------------------------------------------- cards */

  /** Rebuild the deck, leaving out keep-cards that players are still holding. */
  private refillDeck(): void {
    const escapeHeld = this.state.players.some((p) => p.escapeCards > 0);
    const shieldHeld = this.state.players.some((p) => p.shieldCards > 0);
    const ids = CHANCE_DECK.map((c) => c.id).filter(
      (id) => !(id === 'escape' && escapeHeld) && !(id === 'shield' && shieldHeld),
    );
    this.state.deck = shuffle(ids);
  }

  private drawCard(playerId: string, depth: number): void {
    if (this.state.deck.length === 0) this.refillDeck();
    const id = this.state.deck.shift();
    const card: Card | undefined = id ? CARD_BY_ID[id] : undefined;
    if (!id || !card) return;
    const keep = card.effect.kind === 'escape_card' || card.effect.kind === 'shield_card';
    if (!keep) this.state.deck.push(id);

    this.state.lastCard = { text: card.text, playerId, at: Date.now() };
    this.emit({ t: 'card', playerId, text: card.text });
    this.log(`${this.name(playerId)} draws Chance: ${card.text}`, 'card', playerId);
    this.applyCard(playerId, card, depth);
  }

  private applyCard(playerId: string, card: Card, depth: number): void {
    const player = this.player(playerId);
    if (!player) return;
    const effect = card.effect;
    const rivals = this.state.players.filter((p) => p.id !== playerId && !p.bankrupt);
    const thenLand = () => {
      if (depth < MAX_CARD_DEPTH) this.resolveLanding(playerId, depth + 1);
    };

    switch (effect.kind) {
      case 'cash':
        if (effect.amount >= 0) this.credit(playerId, effect.amount, 'Chance');
        else this.charge(playerId, -effect.amount, null, 'Chance');
        break;
      case 'collect_each':
        for (const rival of rivals) this.forcePay(rival.id, effect.amount, playerId, 'Chance');
        break;
      case 'pay_each': {
        const total = effect.amount * rivals.length;
        if (total > 0) {
          this.charge(playerId, total, null, 'Chance', {
            playerIds: rivals.map((r) => r.id),
            each: effect.amount,
          });
        }
        break;
      }
      case 'move_to':
        this.advanceTo(playerId, effect.index, { collectSalary: effect.collectSalary, jump: true });
        thenLand();
        break;
      case 'move_relative':
        this.advanceTo(playerId, player.position + effect.steps, {
          collectSalary: false,
          steps: effect.steps,
          jump: false,
        });
        thenLand();
        break;
      case 'next_resort': {
        const distances = RESORT_INDEXES.map((i) => ({
          index: i,
          distance: (i - player.position + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE,
        })).sort((a, b) => a.distance - b.distance);
        const target = distances[0];
        this.advanceTo(playerId, target.index, {
          collectSalary: true,
          steps: target.distance,
          jump: true,
        });
        thenLand();
        break;
      }
      case 'go_to_island':
        this.sendToIsland(playerId, 'Sent by a Chance card.');
        break;
      case 'escape_card':
        player.escapeCards += 1;
        break;
      case 'shield_card':
        player.shieldCards += 1;
        break;
      case 'earthquake':
        this.earthquake(playerId);
        break;
      case 'host_championship':
        this.offerChampionship(playerId);
        break;
    }
  }

  /** Knock one building off the most built-up rival city that is not a hotel. */
  private earthquake(playerId: string): void {
    const targets = OWNABLE_INDEXES.filter((i) => {
      const holding = this.state.holdings[i];
      return (
        tileAt(i).kind === 'city' &&
        holding.owner &&
        holding.owner !== playerId &&
        holding.level >= 1 &&
        holding.level < HOTEL_LEVEL
      );
    }).sort(
      (a, b) =>
        this.state.holdings[b].level - this.state.holdings[a].level ||
        propertyValue(this.state, b) - propertyValue(this.state, a),
    );
    if (targets.length === 0) {
      this.log('The earthquake rattles the windows, but nothing falls.', 'card');
      return;
    }
    const index = targets[0];
    const holding = this.state.holdings[index];
    const victim = holding.owner;
    holding.level -= 1;
    if (holding.level === 0) holding.owner = null;
    this.emit({ t: 'earthquake', tile: index, level: holding.level });
    this.log(
      holding.owner
        ? `The earthquake brings down a house in ${tileAt(index).name}.`
        : `The earthquake levels ${tileAt(index).name}; ${this.name(victim)} loses the city.`,
      'danger',
      victim ?? undefined,
    );
  }

  /* ------------------------------------------------------------ the turn */

  /**
   * Called once a landing is fully resolved. Doubles roll again; otherwise
   * the turn passes on automatically, exactly as the table plays.
   */
  private continueTurn(): void {
    if (!this.playing) return;
    if (
      this.state.buildOffer ||
      this.state.buyoutOffer ||
      this.state.championshipOffer ||
      this.state.pendingDebt
    ) {
      return;
    }
    const player = this.current;
    if (!player || player.bankrupt) {
      this.advanceTurn();
      return;
    }
    if (this.state.lastDoubles && !player.onIsland && !player.travelPending) {
      this.log(`${player.name} rolled doubles and goes again.`, 'roll', player.id);
      this.setPhase('pre_roll', this.state.settings.turnSeconds);
      return;
    }
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (!this.playing) return;
    this.state.doublesCount = 0;
    this.state.lastDoubles = false;
    this.state.buildOffer = null;
    this.state.buyoutOffer = null;
    this.state.championshipOffer = null;

    const alive = activePlayers(this.state);
    if (alive.length <= 1) {
      this.finish(alive[0]?.id ?? null, 'bankruptcy');
      return;
    }
    if (this.state.endsAt && Date.now() >= this.state.endsAt) {
      this.finishOnWealth();
      return;
    }
    let guard = 0;
    do {
      this.state.currentIndex = (this.state.currentIndex + 1) % this.state.order.length;
      guard++;
    } while (guard <= this.state.order.length && this.current?.bankrupt);

    this.state.turnCount++;
    const player = this.current;
    if (player) {
      this.emit({ t: 'turn', playerId: player.id });
      this.log(`${player.name} is up.`, 'system', player.id);
    }
    this.setPhase('pre_roll', this.state.settings.turnSeconds);
  }

  private finishOnWealth(): void {
    const ranked = activePlayers(this.state)
      .map((p) => ({ id: p.id, worth: netWorth(this.state, p.id) }))
      .sort((a, b) => b.worth - a.worth);
    this.finish(ranked[0]?.id ?? null, 'time');
  }

  private finish(winnerId: string | null, reason: WinReason): void {
    this.state.status = 'finished';
    this.state.winnerId = winnerId;
    this.state.winReason = reason;
    this.state.buildOffer = null;
    this.state.buyoutOffer = null;
    this.state.championshipOffer = null;
    this.state.pendingDebt = null;
    this.setPhase('game_over');
    this.emit({ t: 'gameover', winnerId, reason });
    this.log(
      winnerId
        ? `${this.name(winnerId)} wins - ${WIN_LABEL[reason]}!`
        : `The game ends - ${WIN_LABEL[reason]}.`,
      'win',
      winnerId ?? undefined,
    );
  }

  /** Ends the game if this player has just completed a monopoly. */
  private checkWin(playerId: string): boolean {
    if (!this.playing) return true;
    const reason = winCheck(this.state, playerId);
    if (!reason) return false;
    this.finish(playerId, reason);
    return true;
  }

  private checkGameOver(): boolean {
    if (!this.playing) return true;
    const alive = activePlayers(this.state);
    if (alive.length <= 1) {
      this.finish(alive[0]?.id ?? null, 'bankruptcy');
      return true;
    }
    return false;
  }

  /** Common checks for actions the current player takes before rolling. */
  private preRollGuard(playerId: string): string | null {
    if (!this.playing) return 'The game is not running';
    if (this.currentId !== playerId) return 'It is not your turn';
    if (this.state.phase !== 'pre_roll') return 'You cannot do that right now';
    const player = this.player(playerId);
    if (!player || player.bankrupt) return 'You are out of the game';
    return null;
  }

  /* --------------------------------------------------------------- roll */

  roll(playerId: string): Ack {
    const guard = this.preRollGuard(playerId);
    if (guard) return errRes(guard);
    const player = this.player(playerId)!;
    // Rolling instead of flying gives up the World Tour flight.
    player.travelPending = false;

    const a = rollDie();
    const b = rollDie();
    const total = a + b;
    const doubles = a === b;
    this.state.dice = [a, b];
    this.state.rollId++;
    this.state.lastDoubles = doubles;
    this.emit({ t: 'roll', playerId, dice: [a, b], rollId: this.state.rollId });
    this.log(`${player.name} rolls ${a} and ${b}${doubles ? ' - doubles!' : ''}.`, 'roll', playerId);

    if (player.onIsland) {
      this.rollOnIsland(playerId, total, doubles);
    } else if (doubles && ++this.state.doublesCount >= 3) {
      this.sendToIsland(playerId, 'Three doubles in a row.');
    } else {
      if (!doubles) this.state.doublesCount = 0;
      this.advanceTo(playerId, player.position + total, {
        collectSalary: true,
        steps: total,
        jump: false,
      });
      this.resolveLanding(playerId);
    }
    this.continueTurn();
    this.bump();
    return okRes;
  }

  private rollOnIsland(playerId: string, total: number, doubles: boolean): void {
    const player = this.player(playerId)!;
    this.state.lastDoubles = false;
    this.state.doublesCount = 0;
    if (doubles) {
      this.releaseFromIsland(playerId, 'doubles');
      this.log(`${player.name} rolls doubles and sails away.`, 'island', playerId);
    } else {
      player.islandTurns += 1;
      if (player.islandTurns < 3) {
        this.log(`${player.name} is still stranded (${player.islandTurns} of 3).`, 'island', playerId);
        return;
      }
      this.releaseFromIsland(playerId, 'waited');
      this.log(`${player.name} has waited three turns and is rescued.`, 'island', playerId);
    }
    this.advanceTo(playerId, player.position + total, {
      collectSalary: true,
      steps: total,
      jump: false,
    });
    this.resolveLanding(playerId);
  }

  /* ------------------------------------------------ island and world tour */

  payIslandFee(playerId: string): Ack {
    const guard = this.preRollGuard(playerId);
    if (guard) return errRes(guard);
    const player = this.player(playerId)!;
    if (!player.onIsland) return errRes('You are not on the Island');
    const fee = this.state.settings.islandFee;
    if (player.cash < fee) return errRes('You cannot afford the boat');
    this.settle(playerId, fee, null, 'Island boat');
    this.releaseFromIsland(playerId, 'fee');
    this.log(`${player.name} pays ${formatMoney(fee)} for a boat off the Island.`, 'island', playerId);
    this.bump();
    return okRes;
  }

  useEscape(playerId: string): Ack {
    const guard = this.preRollGuard(playerId);
    if (guard) return errRes(guard);
    const player = this.player(playerId)!;
    if (!player.onIsland) return errRes('You are not on the Island');
    if (player.escapeCards < 1) return errRes('You have no escape card');
    player.escapeCards -= 1;
    this.state.deck.push('escape');
    this.releaseFromIsland(playerId, 'card');
    this.log(`${player.name} plays an escape card and leaves the Island.`, 'island', playerId);
    this.bump();
    return okRes;
  }

  /** World Tour: fly to an unclaimed city or resort, or to one you own. */
  travel(playerId: string, tile: number): Ack {
    const guard = this.preRollGuard(playerId);
    if (guard) return errRes(guard);
    const player = this.player(playerId)!;
    if (!player.travelPending) return errRes('You can only fly from World Tour');
    if (!isInteger(tile) || tile < 0 || tile >= BOARD_SIZE) return errRes('Unknown destination');
    const target = tileAt(tile);
    if (target.kind !== 'city' && target.kind !== 'resort') {
      return errRes('World Tour flies to cities and resorts only');
    }
    const owner = this.state.holdings[tile].owner;
    if (owner && owner !== playerId) return errRes('That city belongs to a rival');
    const fee = this.state.settings.worldTourFee;
    if (player.cash < fee) return errRes('You cannot afford the ticket');

    this.settle(playerId, fee, null, 'World Tour ticket');
    player.travelPending = false;
    this.state.lastDoubles = false;
    this.state.doublesCount = 0;
    const steps = (tile - player.position + BOARD_SIZE) % BOARD_SIZE;
    this.log(`${player.name} flies to ${target.name}.`, 'system', playerId);
    this.advanceTo(playerId, tile, { collectSalary: true, steps, jump: true });
    this.resolveLanding(playerId);
    this.continueTurn();
    this.bump();
    return okRes;
  }

  /* ---------------------------------------------------------- decisions */

  build(playerId: string, level: number): Ack {
    const offer = this.state.buildOffer;
    if (!offer || this.state.phase !== 'build') return errRes('There is nothing to build');
    if (offer.playerId !== playerId) return errRes('That choice is not yours');
    const option = offer.options.find((o) => o.level === level);
    if (!option) return errRes('That building is not available here');
    const player = this.player(playerId)!;
    if (player.cash < option.cost) return errRes('Not enough cash');

    const tile = tileAt(offer.tile);
    const holding = this.state.holdings[offer.tile];
    this.settle(playerId, option.cost, null, `Built in ${tile.name}`);
    holding.owner = playerId;
    holding.level = option.level;
    this.state.buildOffer = null;
    this.emit({
      t: 'build',
      playerId,
      tile: offer.tile,
      level: option.level,
      cost: option.cost,
      bought: offer.mode === 'buy',
    });
    const what =
      tile.kind === 'resort'
        ? `buys the resort of ${tile.name}`
        : option.level === HOTEL_LEVEL
          ? `opens a hotel in ${tile.name}`
          : `${offer.mode === 'buy' ? 'claims' : 'builds up'} ${tile.name} (${option.level} house${option.level > 1 ? 's' : ''})`;
    this.log(`${player.name} ${what} for ${formatMoney(option.cost)}.`, 'property', playerId);

    if (!this.checkWin(playerId)) this.continueTurn();
    this.bump();
    return okRes;
  }

  skipBuild(playerId: string): Ack {
    const offer = this.state.buildOffer;
    if (!offer) return errRes('There is nothing to build');
    if (offer.playerId !== playerId) return errRes('That choice is not yours');
    this.state.buildOffer = null;
    this.continueTurn();
    this.bump();
    return okRes;
  }

  buyout(playerId: string): Ack {
    const offer = this.state.buyoutOffer;
    if (!offer || this.state.phase !== 'buyout') return errRes('There is nothing to buy out');
    if (offer.playerId !== playerId) return errRes('That offer is not yours');
    const check = canBuyout(this.state, playerId, offer.tile);
    if (!check.ok) return errRes(check.reason ?? 'You cannot buy that out');

    const holding = this.state.holdings[offer.tile];
    const previous = holding.owner!;
    this.settle(playerId, check.cost, previous, `Buyout of ${tileAt(offer.tile).name}`);
    holding.owner = playerId;
    this.state.buyoutOffer = null;
    this.emit({ t: 'buyout', playerId, fromId: previous, tile: offer.tile, price: check.cost });
    this.log(
      `${this.name(playerId)} buys ${tileAt(offer.tile).name} out from ${this.name(previous)} for ${formatMoney(check.cost)}.`,
      'property',
      playerId,
    );
    if (!this.checkWin(playerId)) {
      // A new owner may build straight away.
      this.offerBuild(playerId, offer.tile, 'upgrade');
      this.continueTurn();
    }
    this.bump();
    return okRes;
  }

  skipBuyout(playerId: string): Ack {
    const offer = this.state.buyoutOffer;
    if (!offer) return errRes('There is nothing to buy out');
    if (offer.playerId !== playerId) return errRes('That offer is not yours');
    this.state.buyoutOffer = null;
    this.continueTurn();
    this.bump();
    return okRes;
  }

  hostChampionship(playerId: string, tile: number): Ack {
    const offer = this.state.championshipOffer;
    if (!offer || this.state.phase !== 'championship') return errRes('No championship to host');
    if (offer.playerId !== playerId) return errRes('That choice is not yours');
    if (!isInteger(tile) || tileAt(tile).kind !== 'city') return errRes('Pick one of your cities');
    if (this.state.holdings[tile]?.owner !== playerId) return errRes('Pick one of your cities');

    this.state.championship.level += 1;
    this.state.championship.tile = tile;
    const multiplier = 1 + this.state.championship.level;
    this.state.championshipOffer = null;
    this.emit({ t: 'championship', playerId, tile, multiplier });
    this.log(
      `${this.name(playerId)} brings the championship to ${tileAt(tile).name}: rent x${multiplier}.`,
      'property',
      playerId,
    );
    this.continueTurn();
    this.bump();
    return okRes;
  }

  skipChampionship(playerId: string): Ack {
    const offer = this.state.championshipOffer;
    if (!offer) return errRes('No championship to host');
    if (offer.playerId !== playerId) return errRes('That choice is not yours');
    this.state.championshipOffer = null;
    this.continueTurn();
    this.bump();
    return okRes;
  }

  /* ------------------------------------------------------- debt and ruin */

  sellProperty(playerId: string, tile: number): Ack {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== playerId) return errRes('You can only sell to cover a debt');
    if (!isInteger(tile) || this.state.holdings[tile]?.owner !== playerId) {
      return errRes('You do not own that');
    }
    this.sellInternal(playerId, tile);
    this.bump();
    return okRes;
  }

  settleDebt(playerId: string): Ack {
    const debt = this.state.pendingDebt;
    if (!debt) return errRes('You owe nothing');
    if (debt.debtorId !== playerId) return errRes('That debt is not yours');
    const player = this.player(playerId)!;
    if (player.cash < debt.amount) return errRes('You still cannot cover it');
    if (debt.distribute) {
      for (const id of debt.distribute.playerIds) {
        this.settle(playerId, debt.distribute.each, id, debt.reason);
      }
    } else {
      this.settle(playerId, debt.amount, debt.creditorId, debt.reason);
    }
    this.log(`${player.name} settles ${formatMoney(debt.amount)}.`, 'money', playerId);
    this.state.pendingDebt = null;
    this.continueTurn();
    this.bump();
    return okRes;
  }

  declareBankruptcy(playerId: string): Ack {
    const debt = this.state.pendingDebt;
    if (!debt || debt.debtorId !== playerId) {
      return errRes('You can only go bankrupt against a debt you cannot pay');
    }
    this.bankruptTo(playerId, debt.creditorId);
    if (this.playing) this.advanceTurn();
    this.bump();
    return okRes;
  }

  /**
   * Everything the debtor owns is sold to the bank; a rival creditor receives
   * all of the proceeds. The cities return to the board unowned. This never
   * moves the turn on - the caller decides what happens next.
   */
  private bankruptTo(debtorId: string, creditorId: string | null): void {
    const debtor = this.player(debtorId);
    if (!debtor || debtor.bankrupt) return;
    const creditor = creditorId ? this.player(creditorId) : null;

    for (const index of playerHoldings(this.state, debtorId)) this.sellInternal(debtorId, index);
    if (creditor && debtor.cash > 0) this.settle(debtorId, debtor.cash, creditor.id, 'Bankruptcy');
    for (let i = 0; i < debtor.escapeCards; i++) this.state.deck.push('escape');
    for (let i = 0; i < debtor.shieldCards; i++) this.state.deck.push('shield');

    debtor.cash = 0;
    debtor.escapeCards = 0;
    debtor.shieldCards = 0;
    debtor.onIsland = false;
    debtor.travelPending = false;
    debtor.bankrupt = true;
    if (this.state.pendingDebt?.debtorId === debtorId) this.state.pendingDebt = null;
    if (this.state.buildOffer?.playerId === debtorId) this.state.buildOffer = null;
    if (this.state.buyoutOffer?.playerId === debtorId) this.state.buyoutOffer = null;
    if (this.state.championshipOffer?.playerId === debtorId) this.state.championshipOffer = null;
    for (const trade of this.state.trades) {
      if (trade.status === 'open' && (trade.fromId === debtorId || trade.toId === debtorId)) {
        trade.status = 'void';
      }
    }
    this.emit({ t: 'bankrupt', playerId: debtorId, creditorId });
    this.log(
      creditor
        ? `${debtor.name} is bankrupt. ${creditor.name} collects what was left.`
        : `${debtor.name} is bankrupt.`,
      'danger',
      debtorId,
    );
    this.checkGameOver();
  }

  private autoResolveDebt(): void {
    const debt = this.state.pendingDebt;
    if (!debt) return;
    this.autoLiquidate(debt.debtorId, debt.amount);
    const player = this.player(debt.debtorId);
    if (player && player.cash >= debt.amount) {
      this.log(`${player.name} runs out of time; the bank sells enough to pay.`, 'danger', player.id);
      this.settleDebt(debt.debtorId);
      return;
    }
    this.bankruptTo(debt.debtorId, debt.creditorId);
    if (this.playing) this.advanceTurn();
  }

  /* ------------------------------------------------------ trades (house rule) */

  proposeTrade(
    playerId: string,
    input: {
      toId: string;
      offerCash: number;
      requestCash: number;
      offerTiles: number[];
      requestTiles: number[];
    },
  ): Ack {
    if (!this.state.settings.tradingEnabled) return errRes('Trading is off at this table');
    const guard = this.preRollGuard(playerId);
    if (guard) return errRes(guard === 'You cannot do that right now' ? 'Trade before you roll' : guard);
    const from = this.player(playerId)!;
    const to = this.player(input.toId);
    if (!to || to.id === from.id) return errRes('Pick a rival to trade with');
    if (to.bankrupt) return errRes('That player is out of the game');

    const offerCash = Math.max(0, Math.floor(Number(input.offerCash) || 0));
    const requestCash = Math.max(0, Math.floor(Number(input.requestCash) || 0));
    const offerTiles = [...new Set((input.offerTiles ?? []).filter(isInteger))];
    const requestTiles = [...new Set((input.requestTiles ?? []).filter(isInteger))];
    if (!offerTiles.length && !requestTiles.length && !offerCash && !requestCash) {
      return errRes('An offer needs something on the table');
    }
    if (offerCash > from.cash) return errRes('You do not have that much cash');
    for (const i of offerTiles) {
      if (this.state.holdings[i]?.owner !== playerId || !canTransfer(this.state, i).ok) {
        return errRes('You do not own everything you offered');
      }
    }
    for (const i of requestTiles) {
      if (this.state.holdings[i]?.owner !== to.id || !canTransfer(this.state, i).ok) {
        return errRes('They do not own everything you asked for');
      }
    }
    if (this.state.trades.some((t) => t.status === 'open' && t.fromId === playerId && t.toId === to.id)) {
      return errRes('You already have an offer waiting with them');
    }
    const trade: TradeOffer = {
      id: newId(),
      fromId: playerId,
      toId: to.id,
      offerCash,
      requestCash,
      offerTiles,
      requestTiles,
      status: 'open',
      createdAt: Date.now(),
    };
    this.state.trades = this.state.trades.filter((t) => t.status === 'open');
    this.state.trades.push(trade);
    this.emit({ t: 'trade', tradeId: trade.id, status: 'open', fromId: playerId, toId: to.id });
    this.log(`${from.name} sends ${to.name} a trade offer.`, 'trade', playerId);
    this.bump();
    return okRes;
  }

  respondTrade(playerId: string, tradeId: string, accept: boolean): Ack {
    const trade = this.state.trades.find((t) => t.id === tradeId);
    if (!trade || trade.status !== 'open') return errRes('That offer is no longer open');
    if (trade.toId !== playerId) return errRes('That offer is not addressed to you');
    const from = this.player(trade.fromId);
    const to = this.player(trade.toId);
    if (!from || !to) return errRes('Unknown player');

    if (!accept) {
      trade.status = 'declined';
      this.emit({ t: 'trade', tradeId, status: 'declined', fromId: from.id, toId: to.id });
      this.log(`${to.name} declines the offer from ${from.name}.`, 'trade', playerId);
      this.bump();
      return okRes;
    }
    // Re-check everything: the board may have moved on since it was offered.
    if (from.cash < trade.offerCash) return errRes('They can no longer cover their side');
    if (to.cash < trade.requestCash) return errRes('You cannot cover your side');
    if (trade.offerTiles.some((i) => this.state.holdings[i]?.owner !== from.id)) {
      return errRes('They no longer own part of that offer');
    }
    if (trade.requestTiles.some((i) => this.state.holdings[i]?.owner !== to.id)) {
      return errRes('You no longer own part of that offer');
    }
    if (trade.offerCash > 0) this.settle(from.id, trade.offerCash, to.id, 'Trade');
    if (trade.requestCash > 0) this.settle(to.id, trade.requestCash, from.id, 'Trade');
    for (const i of trade.offerTiles) this.state.holdings[i].owner = to.id;
    for (const i of trade.requestTiles) this.state.holdings[i].owner = from.id;
    trade.status = 'accepted';
    this.emit({ t: 'trade', tradeId, status: 'accepted', fromId: from.id, toId: to.id });
    this.log(`${to.name} accepts the trade with ${from.name}.`, 'trade', playerId);
    if (!this.checkWin(from.id)) this.checkWin(to.id);
    this.bump();
    return okRes;
  }

  cancelTrade(playerId: string, tradeId: string): Ack {
    const trade = this.state.trades.find((t) => t.id === tradeId);
    if (!trade || trade.status !== 'open') return errRes('That offer is no longer open');
    if (trade.fromId !== playerId) return errRes('That offer is not yours to withdraw');
    trade.status = 'cancelled';
    this.emit({ t: 'trade', tradeId, status: 'cancelled', fromId: trade.fromId, toId: trade.toId });
    this.log(`${this.name(playerId)} withdraws a trade offer.`, 'trade', playerId);
    this.bump();
    return okRes;
  }

  /* --------------------------------------------------------- turn clock */

  /** Called on a server interval; decides for a player whose clock ran out. */
  tick(now: number = Date.now()): boolean {
    if (!this.playing) return false;
    const deadline = this.state.deadline;
    if (!deadline || now < deadline) return false;
    const before = this.state.version;

    switch (this.state.phase) {
      case 'pre_roll': {
        const id = this.currentId;
        if (id) {
          this.log(`${this.name(id)} ran out of time - the dice roll themselves.`, 'system', id);
          this.roll(id);
        }
        break;
      }
      case 'build':
        if (this.state.buildOffer) this.skipBuild(this.state.buildOffer.playerId);
        break;
      case 'buyout':
        if (this.state.buyoutOffer) this.skipBuyout(this.state.buyoutOffer.playerId);
        break;
      case 'championship': {
        const offer = this.state.championshipOffer;
        if (offer) {
          // A free boost should not be wasted: host it in the best city.
          const best = playerHoldings(this.state, offer.playerId)
            .filter((i) => tileAt(i).kind === 'city')
            .sort((a, b) => rentFor(this.state, b) - rentFor(this.state, a))[0];
          if (best !== undefined) this.hostChampionship(offer.playerId, best);
          else this.skipChampionship(offer.playerId);
        }
        break;
      }
      case 'in_debt':
        this.autoResolveDebt();
        this.bump();
        break;
      default:
        break;
    }
    if (this.state.version === before) this.setPhase(this.state.phase, 10);
    return this.state.version !== before;
  }

  /* ------------------------------------------------------------ dispatch */

  /**
   * Single entry point for every in-game message. Node handles one socket
   * message at a time and each branch runs synchronously, so simultaneous
   * clicks are serialised here rather than interleaved.
   */
  dispatch(playerId: string, action: GameAction): Ack {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return errRes('Malformed action');
    }
    const player = this.player(playerId);
    if (!player) return errRes('You are not in this room');
    if (this.state.status === 'finished') return errRes('The game is over');
    if (!this.playing) return errRes('The game has not started');
    if (player.bankrupt) return errRes('You are out of the game');

    switch (action.type) {
      case 'roll':
        return this.roll(playerId);
      case 'build':
        return this.build(playerId, action.level);
      case 'skipBuild':
        return this.skipBuild(playerId);
      case 'buyout':
        return this.buyout(playerId);
      case 'skipBuyout':
        return this.skipBuyout(playerId);
      case 'hostChampionship':
        return this.hostChampionship(playerId, action.tile);
      case 'skipChampionship':
        return this.skipChampionship(playerId);
      case 'travel':
        return this.travel(playerId, action.tile);
      case 'payIslandFee':
        return this.payIslandFee(playerId);
      case 'useEscape':
        return this.useEscape(playerId);
      case 'sellProperty':
        return this.sellProperty(playerId, action.tile);
      case 'settleDebt':
        return this.settleDebt(playerId);
      case 'declareBankruptcy':
        return this.declareBankruptcy(playerId);
      case 'proposeTrade':
        return this.proposeTrade(playerId, action);
      case 'respondTrade':
        return this.respondTrade(playerId, action.tradeId, !!action.accept);
      case 'cancelTrade':
        return this.cancelTrade(playerId, action.tradeId);
      default:
        return errRes('Unknown action');
    }
  }

  /** Ranked standings, used by the game-over screen and the timer. */
  standings(): { playerId: string; worth: number }[] {
    return this.state.players
      .map((p) => ({ playerId: p.id, worth: p.bankrupt ? 0 : netWorth(this.state, p.id) }))
      .sort((a, b) => b.worth - a.worth);
  }
}
