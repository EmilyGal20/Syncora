// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpProvider, type FetchLike } from './http';
import type { PlanRequest, PlanResult } from './types';

const TODAY = '2026-10-11';
const request: PlanRequest = { goal: 'Finish my project by Thursday', deadline: null, projectId: 'p_secret', projectName: 'Website', today: TODAY };

const goodBody = JSON.stringify({
  version: 1,
  providerLabel: 'Server',
  suggestions: [{ title: 'Plan', description: '', priority: 'high', estimateMinutes: 90, dueDate: '2026-10-13', subtasks: ['a'] }],
});

const respond = (body: string, init: ResponseInit = { status: 200 }) => new Response(body, init);

function setup(fetchImpl: FetchLike, timeoutMs = 1000) {
  const spy = vi.fn(fetchImpl);
  return { spy, provider: createHttpProvider({ endpoint: '/api/plan', timeoutMs, fetchImpl: spy }) };
}

const kind = (r: PlanResult) => (r.ok ? 'ok' : r.error.kind);

afterEach(() => {
  vi.useRealTimers();
});

describe('createHttpProvider', () => {
  it('posts the request and validates the response', async () => {
    const { spy, provider } = setup(async () => respond(goodBody));
    const result = await provider.generate(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.source).toBe('ai');
    expect(result.plan.providerLabel).toBe('AI planner');
    expect(result.plan.suggestions[0]).toMatchObject({ title: 'Plan', priority: 'high', dueDate: '2026-10-13' });

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/plan');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
    const sent = JSON.parse(init.body as string);
    expect(sent).toEqual({ version: 1, goal: request.goal, deadline: '2026-10-15', today: TODAY, projectName: 'Website' });
  });

  it('never sends the project id', async () => {
    const { spy, provider } = setup(async () => respond(goodBody));
    await provider.generate(request);
    const body = spy.mock.calls[0][1].body as string;
    expect(body).not.toContain('projectId');
    expect(body).not.toContain('p_secret');
  });

  it('maps a non-JSON body to malformed', async () => {
    const { provider } = setup(async () => respond('<html>Server error: secret details</html>'));
    const result = await provider.generate(request);
    expect(kind(result)).toBe('malformed');
    expect(result.ok === false && result.error.message).not.toContain('secret');
  });

  it('maps an oversized response to too_large', async () => {
    const big = setup(async () => respond('x'.repeat(70 * 1024)));
    expect(kind(await big.provider.generate(request))).toBe('too_large');
    const declared = setup(async () => respond(goodBody, { status: 200, headers: { 'Content-Length': '999999' } }));
    expect(kind(await declared.provider.generate(request))).toBe('too_large');
  });

  it('maps 429 to rate_limited with a clamped Retry-After', async () => {
    const { provider } = setup(async () => respond('slow down', { status: 429, headers: { 'Retry-After': '9999' } }));
    const result = await provider.generate(request);
    expect(result.ok === false && result.error).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 600, retryable: true });
    const low = setup(async () => respond('', { status: 429, headers: { 'Retry-After': '0' } }));
    const lowResult = await low.provider.generate(request);
    expect(lowResult.ok === false && lowResult.error.retryAfterSeconds).toBe(1);
  });

  it('maps 500 to a retryable http error and 400 to a final one', async () => {
    const r500 = await setup(async () => respond('Internal: stack trace', { status: 500 })).provider.generate(request);
    expect(r500.ok === false && r500.error).toMatchObject({ kind: 'http', status: 500, retryable: true });
    expect(r500.ok === false && r500.error.message).not.toContain('stack');
    const r400 = await setup(async () => respond('bad', { status: 400 })).provider.generate(request);
    expect(r400.ok === false && r400.error).toMatchObject({ kind: 'http', status: 400, retryable: false });
  });

  it('maps a network TypeError to network', async () => {
    const { provider } = setup(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(kind(await provider.generate(request))).toBe('network');
  });

  it('times out with an abort', async () => {
    vi.useFakeTimers();
    let seenSignal: AbortSignal | undefined;
    const { provider } = setup(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          seenSignal = init.signal ?? undefined;
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      5000,
    );
    const pending = provider.generate(request);
    await vi.advanceTimersByTimeAsync(5000);
    expect(kind(await pending)).toBe('timeout');
    expect(seenSignal?.aborted).toBe(true);
  });

  it('follows the caller abort signal', async () => {
    const controller = new AbortController();
    const { provider } = setup(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = provider.generate(request, controller.signal);
    controller.abort();
    expect(kind(await pending)).toBe('aborted');
  });

  it('returns aborted without fetching when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { spy, provider } = setup(async () => respond(goodBody));
    expect(kind(await provider.generate(request, controller.signal))).toBe('aborted');
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an oversized request before fetching', async () => {
    // A valid goal (≤ 500 characters) cannot reach 4 KB, so the limit is lowered for the test.
    const spy = vi.fn<FetchLike>(async () => respond(goodBody));
    const provider = createHttpProvider({ endpoint: '/api/plan', fetchImpl: spy, maxRequestBytes: 300 });
    expect(kind(await provider.generate({ ...request, goal: 'short goal' }))).toBe('ok');
    spy.mockClear();
    const result = await provider.generate({ ...request, goal: ''.repeat(100) + ' long goal' });
    expect(kind(result)).toBe('invalid_request');
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects an invalid request before fetching', async () => {
    const { spy, provider } = setup(async () => respond(goodBody));
    expect(kind(await provider.generate({ ...request, goal: 'x' }))).toBe('invalid_request');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('readBodyLimited', () => {
  it('stops reading a stream without Content-Length as soon as it passes the limit', async () => {
    let pulled = 0;
    const chunk = new Uint8Array(16 * 1024).fill(0x61); // 16 KB of "a"
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        if (pulled > 1000) controller.close(); // ~16 MB if read to the end
        else controller.enqueue(chunk);
      },
    });
    const { provider } = setup(async () => new Response(stream, { status: 200 }));
    expect(kind(await provider.generate(request))).toBe('too_large');
    // 64 KB limit / 16 KB chunks: it must give up after a handful of chunks, not read all 1000.
    expect(pulled).toBeLessThan(10);
  });

  it('counts bytes, not characters, for multi-byte text', async () => {
    const { readBodyLimited } = await import('./http');
    const text = 'é'.repeat(40); // 40 characters, 80 bytes in UTF-8
    expect(await readBodyLimited(new Response(text), 100)).toBe(text);
    expect(await readBodyLimited(new Response(text), 60)).toBeNull();
  });
});
