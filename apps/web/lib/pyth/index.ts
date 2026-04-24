// Client-side Pyth helper — bootstrap stub. When we wire this up, use
// `@pythnetwork/hermes-client` SSE streams to feed lightweight-charts.
//
// Shape kept intentionally narrow so callers can mock cheaply during dev.
export interface PythPriceUpdate {
  ticker: string;
  price: number;
  publishTime: number;
}

export async function subscribeToPrice(
  _ticker: string,
  _onUpdate: (u: PythPriceUpdate) => void,
): Promise<() => void> {
  // TODO: replace with real HermesClient SSE subscription.
  return () => {
    /* noop */
  };
}
