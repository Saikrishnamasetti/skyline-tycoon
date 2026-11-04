import type { GameEvent } from './types';

/**
 * How long the table takes to show a roll. The client animates with these
 * numbers and the server holds bots back by the same amount, so nobody acts
 * on a result before the dice and the piece have finished showing it.
 */

/** The dice tumble, then settle on the rolled faces. */
export const DICE_TUMBLE_MS = 950;
export const DICE_SETTLE_MS = 420;
export const DICE_ROLL_MS = DICE_TUMBLE_MS + DICE_SETTLE_MS;
/** A beat after the dice land, so players can read them before the piece sets off. */
export const ROLL_PAUSE_MS = 450;
/** Time a piece spends hopping from one space to the next. */
export const STEP_MS = 280;
/** Longer trips (cards, flights) teleport instead of walking. */
export const MAX_WALK_STEPS = 12;

type MoveEvent = Extract<GameEvent, { t: 'move' }>;

/** Dice moves walk space by space; flights and card jumps teleport. */
export function isWalkingMove(event: MoveEvent): boolean {
  return !event.jump && event.steps !== 0 && Math.abs(event.steps) <= MAX_WALK_STEPS;
}

/**
 * When each event of a batch should play out on screen, in milliseconds from
 * the batch's arrival, and when the whole batch has finished. The dice roll
 * first, a short pause follows, then each walk in order; anything else (rent,
 * a card, a toast) happens once the walk before it has arrived.
 */
export function eventTimeline(events: GameEvent[]): { offsets: number[]; endMs: number } {
  let at = 0;
  let pauseDue = false;
  const offsets = events.map((event) => {
    if (event.t === 'roll') {
      const start = at;
      at += DICE_ROLL_MS;
      pauseDue = true;
      return start;
    }
    if (event.t === 'move' && isWalkingMove(event)) {
      if (pauseDue) at += ROLL_PAUSE_MS;
      pauseDue = false;
      const start = at;
      at += Math.abs(event.steps) * STEP_MS;
      return start;
    }
    return at;
  });
  return { offsets, endMs: at };
}

/** Milliseconds the table needs to show this batch. Zero when nothing rolls or walks. */
export function presentationMs(events: GameEvent[]): number {
  return eventTimeline(events).endMs;
}
