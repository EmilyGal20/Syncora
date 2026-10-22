// @ts-nocheck
import { resolveDeadline } from './deadline';
import { planError } from './errors';
import { PLAN_LIMITS } from './limits';
import type { PlanError, PlanProvider, PlanRequest, PlanResult } from './types';
import { validatePlan, validateRequest } from './validate';

export const HTTP_PROVIDER_LABEL = 'AI planner';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface HttpProviderOptions {
  endpoint: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** Request body limit; only lowered in tests (a valid goal cannot reach the 4 KB default). */
  maxRequestBytes?: number;
}

const fail = (error: PlanError): PlanResult => ({ ok: false, error });

function retryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number.parseInt(header, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(600, Math.max(1, n));
}

/**
 * Reads a response body as text but stops as soon as it exceeds `maxBytes`, so a misbehaving
 * endpoint streaming megabytes is cut off early instead of being buffered in full.
 * Returns null when the limit is exceeded.
 */
export async function readBodyLimited(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    return new TextEncoder().encode(text).length > maxBytes ? null : text;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

let planSeq = 0;

/**
 * Calls our own planning endpoint (never a vendor API). Disabled unless an endpoint is configured.
 * Everything that comes back is validated; server text is never shown to the user.
 */
export function createHttpProvider({
  endpoint,
  timeoutMs = PLAN_LIMITS.timeoutMs,
  fetchImpl,
  maxRequestBytes = PLAN_LIMITS.requestBytes,
}: HttpProviderOptions): PlanProvider {
  const doFetch: FetchLike = fetchImpl ?? ((input, init) => fetch(input, init));

  return {
    id: 'http',
    source: 'ai',
    label: HTTP_PROVIDER_LABEL,
    async generate(input: PlanRequest, signal?: AbortSignal): Promise<PlanResult> {
      if (signal?.aborted) return fail(planError('aborted'));
      const checked = validateRequest(input);
      if (!checked.ok) return fail(planError('invalid_request'));
      const request = checked.request;
      const deadline = resolveDeadline(request);

      // projectId stays on the client; only the display name is useful to a planner.
      const body = JSON.stringify({
        version: 1,
        goal: request.goal,
        deadline: deadline.date,
        today: request.today,
        projectName: request.projectName,
      });
      if (new TextEncoder().encode(body).length > maxRequestBytes) return fail(planError('invalid_request'));

      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onCallerAbort = () => controller.abort();
      signal?.addEventListener('abort', onCallerAbort, { once: true });

      try {
        const res = await doFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
          signal: controller.signal,
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
        });
        if (res.status === 429) {
          return fail(planError('rate_limited', { status: 429, retryAfterSeconds: retryAfterSeconds(res.headers.get('Retry-After')) }));
        }
        if (!res.ok) return fail(planError('http', { status: res.status, retryable: res.status >= 500 }));

        const declared = Number(res.headers.get('Content-Length'));
        if (Number.isFinite(declared) && declared > PLAN_LIMITS.responseBytes) return fail(planError('too_large'));
        const text = await readBodyLimited(res, PLAN_LIMITS.responseBytes);
        if (text === null) return fail(planError('too_large'));

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return fail(planError('malformed'));
        }
        return validatePlan(json, {
          id: `plan_http_${++planSeq}`,
          source: 'ai',
          providerLabel: HTTP_PROVIDER_LABEL,
          goal: request.goal,
          today: request.today,
          effectiveDeadline: deadline.date,
          deadlineSource: deadline.source,
        });
      } catch {
        if (signal?.aborted) return fail(planError('aborted'));
        if (timedOut) return fail(planError('timeout'));
        return fail(planError('network'));
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}
