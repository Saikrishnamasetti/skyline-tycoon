import { CHAMPIONSHIP_INDEX, START_INDEX, WORLD_TOUR_INDEX } from './board';
import type { Card } from './types';

/** One Chance deck: sixteen cards, some helpful, some harmful. */
export const CHANCE_DECK: Card[] = [
  {
    id: 'escape',
    text: 'A fishing boat owes you a favour. Keep this card to leave the Island for free.',
    effect: { kind: 'escape_card' },
  },
  {
    id: 'shield',
    text: 'Diplomatic pass. The next rent you owe is waived. Keep it until you need it.',
    effect: { kind: 'shield_card' },
  },
  {
    id: 'quake',
    text: 'Earthquake! The most built-up rival city loses a building. Hotels stand firm.',
    effect: { kind: 'earthquake' },
  },
  {
    id: 'customs',
    text: 'Customs holds your passport. You are stranded on the Island.',
    effect: { kind: 'go_to_island' },
  },
  {
    id: 'upgrade',
    text: 'Airline upgrade. Fly to World Tour and choose your next stop.',
    effect: { kind: 'move_to', index: WORLD_TOUR_INDEX, collectSalary: true },
  },
  {
    id: 'home',
    text: 'Head office calls you home. Advance to Start and collect your salary.',
    effect: { kind: 'move_to', index: START_INDEX, collectSalary: true },
  },
  {
    id: 'back3',
    text: 'You missed your connection. Go back three spaces.',
    effect: { kind: 'move_relative', steps: -3 },
  },
  {
    id: 'dividend',
    text: 'Your investments pay a dividend. Collect $200,000.',
    effect: { kind: 'cash', amount: 200_000 },
  },
  {
    id: 'fine',
    text: 'Speeding through the city centre. Pay a $100,000 fine.',
    effect: { kind: 'cash', amount: -100_000 },
  },
  {
    id: 'gala',
    text: 'You host a charity gala. Pay every rival $50,000.',
    effect: { kind: 'pay_each', amount: 50_000 },
  },
  {
    id: 'partners',
    text: 'Your partners chip in for the venture. Collect $50,000 from every rival.',
    effect: { kind: 'collect_each', amount: 50_000 },
  },
  {
    id: 'sponsor',
    text: 'Sponsorship deal. Host a championship in one of your cities right now.',
    effect: { kind: 'host_championship' },
  },
  {
    id: 'fan',
    text: 'Season tickets. Travel to the Championship.',
    effect: { kind: 'move_to', index: CHAMPIONSHIP_INDEX, collectSalary: true },
  },
  {
    id: 'holiday',
    text: 'Holiday booked. Advance to the next resort.',
    effect: { kind: 'next_resort' },
  },
  {
    id: 'rebate',
    text: 'The tax office sends a rebate. Collect $150,000.',
    effect: { kind: 'cash', amount: 150_000 },
  },
  {
    id: 'crash',
    text: 'The market dips. Pay $150,000.',
    effect: { kind: 'cash', amount: -150_000 },
  },
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(
  CHANCE_DECK.map((card) => [card.id, card]),
);
