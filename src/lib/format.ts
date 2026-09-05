export function formatSol(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
}

export function formatUsd(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function formatPrice(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.00001) return `$${n.toExponential(6)}`;
  if (n < 1) return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function shorten(mint: string): string {
  if (mint.length <= 12) return mint;
  return `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
