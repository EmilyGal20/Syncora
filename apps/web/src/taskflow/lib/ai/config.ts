// @ts-nocheck
import { demoProvider } from './demo';
import { createHttpProvider } from './http';
import type { PlanProvider } from './types';

export interface PlannerConfig {
  /** Same-origin path of our own planning endpoint, e.g. "/api/plan". */
  endpoint: string;
}

/**
 * Reads only VITE_PLANNER_ENDPOINT, which is public by design (everything Vite bundles is).
 * Keys and secrets never belong here; they stay on the server behind the endpoint.
 * Only same-origin paths are accepted, so a mistaken build value can never send users' goals
 * straight to a third-party or vendor domain.
 */
export function resolvePlannerConfig(env: Record<string, unknown> | undefined | null): PlannerConfig | null {
  const raw = env?.VITE_PLANNER_ENDPOINT;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || /[\s\\]/.test(value) || /[\u0000-\u001F\u007F]/.test(value)) return null;
  // A relative path, but not a protocol-relative "//host" URL.
  return value.startsWith('/') && !value.startsWith('//') ? { endpoint: value } : null;
}

/** The HTTP provider only when an endpoint is configured; otherwise the offline demo. */
export function getActiveProvider(config: PlannerConfig | null): PlanProvider {
  return config?.endpoint ? createHttpProvider({ endpoint: config.endpoint }) : demoProvider;
}
