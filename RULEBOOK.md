# Skyline Tycoon - Rulebook

A real-time property game for 2 to 4 players, played in the fast "world
tour" style: claim cities by building on them, buy rivals out, host
championships, fly anywhere with World Tour, and win on the spot with a
monopoly. Every rule below is enforced by the server.

Money is shown in dollars. Large amounts are abbreviated, so `$350K` means
$350,000 and `$2M` means $2,000,000.

---

## 1. The board

32 spaces run clockwise. Each side has seven spaces between two corners:
two countries (one with two cities, one with three), a resort, and a Chance
or Tax space.

| Corner | What happens |
| --- | --- |
| Start (0) | Collect your salary whenever you pass or land here |
| Island (8) | You are stranded |
| Championship (16) | Host a championship in one of your cities |
| World Tour (24) | Fly anywhere on your next turn |

| Side | Countries | Resort |
| --- | --- | --- |
| 1 | Egypt (Cairo, Luxor), Brazil (Salvador, Rio de Janeiro, Sao Paulo) | Cancun |
| 2 | Turkey (Izmir, Istanbul), Spain (Seville, Barcelona, Madrid) | Bali |
| 3 | Italy (Naples, Milan, Rome), Germany (Munich, Berlin) | Santorini |
| 4 | United Kingdom (Manchester, Edinburgh, London), Japan (Osaka, Tokyo) | Maldives |

Prices rise clockwise: a house in Cairo costs $60K, a house in Tokyo $350K.

---

## 2. Winning

The game ends the moment any player completes one of these:

- **Side Monopoly** - every city along one side of the board.
- **Triple Monopoly** - every city in three countries.
- **Resort Monopoly** - all four resorts.

Otherwise:

- **Last tycoon standing** - everyone else has gone bankrupt.
- **Time** - when the match clock (20 minutes by default) runs out, the
  richest player wins. Wealth is cash plus everything built on each city
  and the price of each resort.

---

## 3. A turn

1. Roll two dice and move clockwise.
2. Deal with the space you land on.
3. A double gives you another roll. Three doubles in one turn strand you on
   the Island.

There is no separate "end turn": once the space is dealt with, play passes on.

Everyone starts with **$2,000,000**. The salary for passing Start is
**$300,000**. Both are adjustable by the host.

---

## 4. Cities

- **Empty city:** claim it by building one or two houses on it. You cannot
  own a city without building.
- **Your own city:** add houses each time you land there.
  - Two houses at most until you have passed Start once.
  - A third house after that.
  - A **hotel** on a later visit, once three houses stand. A hotel can never
    be bought out or damaged by an earthquake.
- **A rival's city:** pay the rent for its current level. Then you may **buy
  it out** for twice what has been built on it. The owner cannot refuse.
  Hotels cannot be bought out.

Rent rises steeply with each level: from half a house's cost with one house,
to seven times a house's cost with a hotel.

---

## 5. Resorts

Resorts are bought outright when you land on an empty one. Rent depends on
how many resorts the owner holds: $100K for one, $250K for two, $600K for
three. Resorts can never be bought out, and owning all four wins the game.

---

## 6. Special spaces

**Island.** You are stranded. On each of your turns you may:

- roll the dice, and escape if you roll a double (you move, but without a
  bonus roll),
- pay $200K for a boat, then roll as normal,
- play an escape card, then roll as normal.

After your third failed roll you are rescued and move on that roll.

**Championship.** Choose one of your cities to host. Its rent is multiplied
by two for the first championship of the game, three for the second, and so
on. Only the latest host city enjoys the boost.

**World Tour.** At the start of your next turn you may fly to any empty city
or resort, or to one of your own, for $50K. Passing Start on the way pays your
salary. You can also ignore the flight and roll as normal.

**Tax Office.** Pay 10% of the value of everything you have built.

**Chance.** Draw a card and follow it. The deck can pay or charge you, move
you, strand you, let you host a championship, or set off an earthquake that
removes a building from the most built-up rival city. Escape cards and rent
passes can be kept until needed.

---

## 7. Running out of money

If you owe more than you hold, play pauses while you sell properties back to
the bank for half of what was built on them. If even selling everything will
not cover the debt, you are bankrupt: a rival creditor receives everything
you had left, and your cities return to the board empty.

Selling is only possible while you are in debt.

---

## 8. The clock

Every decision is timed (30 seconds by default). When time runs out the
server acts for you: it rolls, skips a purchase or buyout, hosts the
championship in your best city, or sells to cover a debt. One absent player
never stalls the table.

---

## 9. House rules

- **Trading** is off in the classic game. The host can switch it on, which
  lets players swap cash and properties before they roll.
- The host can also change the starting cash, the salary, the turn timer and
  the match length, or remove the match clock altogether.
