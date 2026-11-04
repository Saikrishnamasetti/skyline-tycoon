import { BUYOUT_MULTIPLIER, DEFAULT_SETTINGS, RESORT_RENT, formatCompact } from '@shared';
import { Modal } from '../ui/atoms';

const S = DEFAULT_SETTINGS;

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'How to win',
    body: [
      'Finish any one of three monopolies and the game ends on the spot: every city along one side of the board (Side), three whole countries (Triple), or all four resorts (Resort).',
      'Otherwise, be the last player still solvent. If the match clock runs out first, the richest player wins - cash plus everything they have built.',
    ],
  },
  {
    title: 'Your turn',
    body: [
      `Everyone starts with ${formatCompact(S.startingCash)}. Roll two dice and move clockwise. Passing or landing on Start pays ${formatCompact(S.salary)}.`,
      'A double earns another roll. Three doubles in one turn strand you on the Island.',
      'Your turn ends by itself once the space you landed on is dealt with.',
    ],
  },
  {
    title: 'Cities and building',
    body: [
      'Land on an empty city to claim it by building one or two houses. You cannot own a city without building on it.',
      'Land on your own city again to add more. A third house unlocks once you have passed Start, and a hotel can replace three houses on a later visit.',
      'Prices rise clockwise. Rent rises steeply with every level.',
    ],
  },
  {
    title: 'Rent and buyouts',
    body: [
      'Landing on a rival city costs the rent shown on its card.',
      `Once you have paid, you may buy the city outright for ${BUYOUT_MULTIPLIER}x what has been built on it. The owner cannot refuse. Hotels and resorts can never be bought out.`,
    ],
  },
  {
    title: 'Resorts',
    body: [
      `Resorts are bought outright. Rent depends on how many you hold: ${RESORT_RENT.map((r) => formatCompact(r)).join(', ')} for one, two or three. Own all four and you win.`,
    ],
  },
  {
    title: 'The corners',
    body: [
      `Island: you are stranded. Roll doubles to escape, pay ${formatCompact(S.islandFee)} for a boat, play an escape card, or wait - the third failed roll sets you free.`,
      'Championship: pick one of your cities to host. Its rent is multiplied, and every new championship is bigger than the last (x2, then x3, and so on). Only the latest host gets the boost.',
      `World Tour: on your next turn you may fly to any empty city or resort, or one of your own, for ${formatCompact(S.worldTourFee)}. Or just roll.`,
    ],
  },
  {
    title: 'Chance and tax',
    body: [
      'Chance cards can pay you, cost you, move you, strand you, start a championship, or set off an earthquake that knocks a building off a rival city (hotels are earthquake-proof). Escape cards and rent passes can be kept until needed.',
      'The Tax Office takes ten percent of everything you have built.',
    ],
  },
  {
    title: 'Running out of money',
    body: [
      'If you cannot pay, sell properties back to the bank for half of what was built on them. If even that is not enough you are bankrupt: a rival you owed receives what you had left, and your cities return to the board empty.',
    ],
  },
  {
    title: 'The clock',
    body: [
      'Every decision is timed. If you run out of time the server acts for you, so one absent player never holds up the table.',
    ],
  },
];

export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} wide title="How to play">
      {/* Two columns on wide screens keep each line a comfortable length. */}
      <div className="gap-8 md:columns-2">
        {SECTIONS.map((section) => (
          <section key={section.title} className="mb-6 break-inside-avoid">
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-sky-600">
              {section.title}
            </h3>
            <div className="mt-2 space-y-2">
              {section.body.map((line) => (
                <p key={line} className="text-base leading-relaxed text-slate-700">
                  {line}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
