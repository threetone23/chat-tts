import { getOverlayConfig } from '../constants';
import { GLOBAL_PROVIDER_REGISTRY, type StockProvider } from './providers';
import { GLOBAL_BANKRUPTCY_MONITOR } from './bankruptcy';
import { createPubSub, type Unsubscribe } from '../stores/pubsub';

export interface CyclerSnapshot {
  symbol: string;
  label: string;
  icon?: string;
  color?: string;
  current: number;
  history: number[];
  bankrupt: boolean;
}

export interface CyclerStore {
  subscribe: (fn: (snap: CyclerSnapshot) => void) => Unsubscribe;
  get snapshot(): CyclerSnapshot;
  start: () => void;
  stop: () => void;
  registerProvider: (provider: StockProvider) => void;
}

export function createCyclerStore(): CyclerStore {
  let currentIndex = 0;
  const historyMap = new Map<string, number[]>();
  const MAX_HISTORY = 500;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let currentSnapshot: CyclerSnapshot = {
    symbol: 'HEART',
    label: 'Heartrate',
    current: getOverlayConfig().modelConfig.initialHeartrate,
    history: [],
    bankrupt: false
  };

  const pub = createPubSub<CyclerSnapshot>();

  function notify() {
    pub.notify(currentSnapshot);
  }

  function subscribe(fn: (snap: CyclerSnapshot) => void): Unsubscribe {
    fn(currentSnapshot);
    return pub.subscribe(fn);
  }

  function recordPoint(provider: StockProvider, value: number) {
    let h = historyMap.get(provider.symbol);
    if (!h) {
      h = [];
      historyMap.set(provider.symbol, h);
    }
    h.push(value);
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);

    GLOBAL_BANKRUPTCY_MONITOR.processValue(provider, provider.sourceValue ?? value);
  }

  function advance() {
    const providers = GLOBAL_PROVIDER_REGISTRY.getAll();
    if (providers.length === 0) return;

    currentIndex = (currentIndex + 1) % providers.length;
    const provider = providers[currentIndex];
    const value = provider.current;

    recordPoint(provider, value);

    const h = historyMap.get(provider.symbol)!;
    currentSnapshot = {
      symbol: provider.symbol,
      label: provider.label,
      icon: provider.icon,
      color: provider.color,
      current: value,
      history: [...h],
      bankrupt: GLOBAL_BANKRUPTCY_MONITOR.isBankrupt(provider.symbol)
    };
    notify();
  }

  function registerProvider(provider: StockProvider) {
    provider.subscribe((value) => {
      recordPoint(provider, value);

      if (currentSnapshot.symbol === provider.symbol) {
        const h = historyMap.get(provider.symbol)!;
        currentSnapshot = {
          ...currentSnapshot,
          icon: provider.icon,
          color: provider.color,
          current: value,
          history: [...h],
          bankrupt: GLOBAL_BANKRUPTCY_MONITOR.isBankrupt(provider.symbol)
        };
        notify();
      }
    });
    advance();
  }

  function start() {
    const interval = getOverlayConfig().stockMarketConfig.cycleIntervalMs;
    advance();
    intervalId = setInterval(advance, interval);
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    subscribe,
    get snapshot() {
      return currentSnapshot;
    },
    start,
    stop,
    registerProvider
  };
}

export function createAndStartCycler(): CyclerStore {
  const store = createCyclerStore();
  // Consumes everything in GLOBAL_PROVIDER_REGISTRY at call time.
  // Ensure stock/providers/index (or equivalent) is imported before this runs.
  for (const provider of GLOBAL_PROVIDER_REGISTRY.getAll()) {
    store.registerProvider(provider);
  }
  store.start();
  return store;
}
