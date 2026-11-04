import { useMemo, useState } from 'react';
import { canTransfer, formatMoney, playerHoldings, propertyValue, tileAt } from '@shared';
import type { GameState, Player } from '@shared';
import { cx } from '../lib/format';
import { useActions } from '../hooks/useActions';
import { Avatar, GroupDot, Modal, Money } from './atoms';

interface TradePanelProps {
  open: boolean;
  onClose: () => void;
  state: GameState;
  me: Player | null;
}

function Side({
  title,
  state,
  holdings,
  selected,
  onToggle,
  cash,
  onCash,
  maxCash,
}: {
  title: string;
  state: GameState;
  holdings: number[];
  selected: number[];
  onToggle: (index: number) => void;
  cash: string;
  onCash: (value: string) => void;
  maxCash: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        <span className="text-[11px] text-slate-500">
          holds <Money amount={maxCash} />
        </span>
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={maxCash}
        value={cash}
        onChange={(event) => onCash(event.target.value)}
        placeholder="Cash (optional)"
        className="field mt-2 px-3 py-2 text-sm"
        aria-label={`${title} cash`}
      />

      <div className="no-scrollbar mt-2 max-h-52 space-y-1 overflow-y-auto">
        {holdings.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">No deeds to offer.</p>
        )}
        {holdings.map((index) => {
          const tile = tileAt(index);
          const transferable = canTransfer(state, index);
          const holding = state.holdings[index];
          const active = selected.includes(index);
          return (
            <button
              key={index}
              type="button"
              disabled={!transferable.ok}
              title={transferable.ok ? undefined : transferable.reason}
              onClick={() => onToggle(index)}
              className={cx(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] transition',
                active ? 'bg-neon-cyan/15 text-slate-900' : 'text-slate-700 hover:bg-slate-100',
                !transferable.ok && 'cursor-not-allowed opacity-40',
              )}
            >
              <GroupDot tile={tile} />
              <span className="flex-1 truncate">{tile.name}</span>
              <span className="font-mono text-[11px] text-slate-500">
                {formatMoney(propertyValue(state, index))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Build an offer: cash and deeds either way, settled atomically by the server. */
export function TradePanel({ open, onClose, state, me }: TradePanelProps) {
  const act = useActions();
  const rivals = state.players.filter((p) => !p.bankrupt && p.id !== me?.id);
  const [partnerId, setPartnerId] = useState<string>('');
  const [offerTiles, setOfferTiles] = useState<number[]>([]);
  const [requestTiles, setRequestTiles] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState('');
  const [requestCash, setRequestCash] = useState('');

  const partner = rivals.find((p) => p.id === partnerId) ?? rivals[0] ?? null;
  const myHoldings = useMemo(() => (me ? playerHoldings(state, me.id) : []), [state, me]);
  const theirHoldings = useMemo(
    () => (partner ? playerHoldings(state, partner.id) : []),
    [state, partner],
  );

  const reset = () => {
    setOfferTiles([]);
    setRequestTiles([]);
    setOfferCash('');
    setRequestCash('');
  };

  if (!me) return null;

  const offerAmount = Math.max(0, Math.floor(Number(offerCash) || 0));
  const requestAmount = Math.max(0, Math.floor(Number(requestCash) || 0));
  const canSend =
    !!partner &&
    (offerTiles.length > 0 || requestTiles.length > 0 || offerAmount > 0 || requestAmount > 0) &&
    offerAmount <= me.cash;

  const toggle = (list: number[], setList: (next: number[]) => void, index: number) => {
    setList(list.includes(index) ? list.filter((i) => i !== index) : [...list, index]);
  };

  const send = async () => {
    if (!partner) return;
    const sent = await act({
      type: 'proposeTrade',
      toId: partner.id,
      offerCash: offerAmount,
      requestCash: requestAmount,
      offerTiles,
      requestTiles,
    });
    if (sent) {
      reset();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      wide
      title="Propose a trade"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            Lots with buildings cannot change hands. Sell the buildings first.
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={reset}>
              Clear
            </button>
            <button type="button" className="btn-primary" disabled={!canSend} onClick={send}>
              Send offer
            </button>
          </div>
        </div>
      }
    >
      {rivals.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          There is nobody left to trade with.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <span className="label">Trading with</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {rivals.map((rival) => (
                <button
                  key={rival.id}
                  type="button"
                  onClick={() => {
                    setPartnerId(rival.id);
                    setRequestTiles([]);
                  }}
                  className={cx(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
                    partner?.id === rival.id
                      ? 'border-neon-cyan/60 bg-neon-cyan/10 text-slate-900'
                      : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <Avatar player={rival} size={24} />
                  {rival.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Side
              title="You give"
              state={state}
              holdings={myHoldings}
              selected={offerTiles}
              onToggle={(index) => toggle(offerTiles, setOfferTiles, index)}
              cash={offerCash}
              onCash={setOfferCash}
              maxCash={me.cash}
            />
            <Side
              title={`${partner?.name ?? 'They'} gives`}
              state={state}
              holdings={theirHoldings}
              selected={requestTiles}
              onToggle={(index) => toggle(requestTiles, setRequestTiles, index)}
              cash={requestCash}
              onCash={setRequestCash}
              maxCash={partner?.cash ?? 0}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function Summary({ state, cash, tiles }: { state: GameState; cash: number; tiles: number[] }) {
  if (cash === 0 && tiles.length === 0) {
    return <div className="text-slate-500">Nothing</div>;
  }
  return (
    <div className="space-y-0.5 text-slate-700">
      {cash > 0 && <div className="font-mono text-emerald-700">{formatMoney(cash)}</div>}
      {tiles.map((index) => (
        <div key={index} className="flex items-center gap-1.5 truncate">
          <GroupDot tile={tileAt(index)} />
          <span className="truncate">{tileAt(index).name}</span>
        </div>
      ))}
    </div>
  );
}

/** Offers addressed to you, shown wherever you are in the turn cycle. */
export function TradeInbox({ state, me }: { state: GameState; me: Player | null }) {
  const act = useActions();
  if (!me) return null;
  const inbox = state.trades.filter((t) => t.status === 'open' && t.toId === me.id);
  const outbox = state.trades.filter((t) => t.status === 'open' && t.fromId === me.id);
  if (inbox.length === 0 && outbox.length === 0) return null;

  return (
    <div className="space-y-2">
      {inbox.map((trade) => {
        const from = state.players.find((p) => p.id === trade.fromId);
        return (
          <div key={trade.id} className="panel animate-pop-in px-3 py-2.5">
            <div className="flex items-center gap-2">
              {from && <Avatar player={from} size={24} />}
              <span className="text-[12.5px] font-semibold text-slate-900">
                {from?.name ?? 'Someone'} offers a trade
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11.5px]">
              <div>
                <span className="label">You get</span>
                <Summary state={state} cash={trade.offerCash} tiles={trade.offerTiles} />
              </div>
              <div>
                <span className="label">You give</span>
                <Summary state={state} cash={trade.requestCash} tiles={trade.requestTiles} />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1 px-3 py-1.5 text-[12px]"
                onClick={() => act({ type: 'respondTrade', tradeId: trade.id, accept: true })}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn-ghost flex-1 px-3 py-1.5 text-[12px]"
                onClick={() => act({ type: 'respondTrade', tradeId: trade.id, accept: false })}
              >
                Decline
              </button>
            </div>
          </div>
        );
      })}
      {outbox.map((trade) => {
        const to = state.players.find((p) => p.id === trade.toId);
        return (
          <div key={trade.id} className="panel flex items-center gap-2 px-3 py-2 text-[12px]">
            <span className="flex-1 text-slate-500">
              Offer pending with {to?.name ?? 'a rival'}
            </span>
            <button
              type="button"
              className="btn-ghost px-2.5 py-1 text-[11px]"
              onClick={() => act({ type: 'cancelTrade', tradeId: trade.id })}
            >
              Withdraw
            </button>
          </div>
        );
      })}
    </div>
  );
}
