// Server-safe demo flag. Both API routes and client components can import this
// without pulling in Zustand / React hooks.

export function isDemo(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true')
  );
}

export function isDemoServer(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true')
  );
}
