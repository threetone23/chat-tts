import { getOverlayConfig } from '../constants';
import type { StockProvider } from './providers';
import type { StockBankruptcyRule } from '$lib/config';

export type BankruptcyTransition = 'bankrupt' | 'recovered' | null;

export interface BankruptcyEffects {
  onBankruptcy: (provider: StockProvider, value: number, rule: StockBankruptcyRule) => void;
  onRecovery: (provider: StockProvider, value: number) => void;
}

export function bankruptcyRuleFor(symbol: string): StockBankruptcyRule | undefined {
  return getOverlayConfig().stockMarketConfig.bankruptcy.find((rule) => rule.symbol === symbol);
}

interface BankruptcyState {
  bankrupt: boolean;
  announced: boolean;
}

export class StockBankruptcyMonitor {
  private state = new Map<string, BankruptcyState>();
  private effects: BankruptcyEffects | null = null;

  setEffects(effects: BankruptcyEffects): void {
    this.effects = effects;
  }

  isBankrupt(symbol: string): boolean {
    return this.state.get(symbol)?.bankrupt ?? false;
  }

  processValue(provider: StockProvider, value: number): BankruptcyTransition {
    const rule = bankruptcyRuleFor(provider.symbol);
    const now = !!(rule?.enabled && value < rule.threshold);

    const st = this.state.get(provider.symbol);
    if (!st) {
      this.state.set(provider.symbol, { bankrupt: now, announced: false });
      return null;
    }

    if (now === st.bankrupt) return null;

    st.bankrupt = now;
    if (now) {
      if (this.effects) {
        st.announced = true;
        this.effects.onBankruptcy(provider, value, rule!);
      } else {
        console.warn(
          `[bankruptcy] ${provider.symbol} went bankrupt before effects were wired; skipping side effects`
        );
      }
      return 'bankrupt';
    }

    const announced = st.announced;
    st.announced = false;
    if (announced) {
      this.effects?.onRecovery(provider, value);
    }
    return 'recovered';
  }
}

export const GLOBAL_BANKRUPTCY_MONITOR = new StockBankruptcyMonitor();
