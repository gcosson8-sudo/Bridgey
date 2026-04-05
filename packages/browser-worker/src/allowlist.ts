import { BridgeyError } from "./errors.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^\*\./u, "").replace(/\.$/u, "");
}

export function hostnameMatchesDomain(hostname: string, allowedDomain: string): boolean {
  const normalizedHost = normalizeDomain(hostname);
  const normalizedAllowed = normalizeDomain(allowedDomain);

  return (
    normalizedHost === normalizedAllowed ||
    normalizedHost.endsWith(`.${normalizedAllowed}`)
  );
}

export function isUrlAllowed(url: string, allowlistDomains: readonly string[]): boolean {
  const parsed = new URL(url);

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  return allowlistDomains.some((domain) => hostnameMatchesDomain(parsed.hostname, domain));
}

export function assertUrlAllowed(url: string, allowlistDomains: readonly string[]): void {
  if (!isUrlAllowed(url, allowlistDomains)) {
    throw new BridgeyError("blocked_domain", 403, `Domain is not allowlisted for ${url}`);
  }
}

