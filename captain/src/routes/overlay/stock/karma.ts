import { getOverlayConfig } from '../constants';
import { karmaStore } from '../stores';
import { GLOBAL_PROVIDER_REGISTRY, type StockProvider } from './providers';
import { KRMA_ICON } from './icons';
import { createPubSub } from '../stores/pubsub';

function karmaToPrice(karma: number): number {
  const { min, max } = getOverlayConfig().karmaConfig;
  const span = max - min;
  if (span <= 0) return 0;
  const clamped = Math.min(max, Math.max(min, karma));
  return Math.round(((clamped - min) / span) * 100 * 100) / 100;
}

export class KarmaStock implements StockProvider {
  readonly symbol = 'KRMA';
  readonly label = 'Karma';
  readonly icon = KRMA_ICON;
  readonly color = 'rgb(255, 215, 0)';
  private pub = createPubSub<number>();
  private _current: number;

  constructor() {
    this._current = karmaToPrice(karmaStore.karma);
    karmaStore.subscribe((karma) => {
      const next = karmaToPrice(karma);
      if (next !== this._current) {
        this._current = next;
        this.pub.notify(next);
      }
    });
    GLOBAL_PROVIDER_REGISTRY.register(this);
  }

  get current(): number {
    return this._current;
  }

  subscribe(fn: (value: number) => void) {
    fn(this._current);
    return this.pub.subscribe(fn);
  }
}
