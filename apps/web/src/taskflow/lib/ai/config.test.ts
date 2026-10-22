// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { getActiveProvider, resolvePlannerConfig } from './config';
import { demoProvider } from './demo';

describe('resolvePlannerConfig', () => {
  it('returns null without an endpoint', () => {
    expect(resolvePlannerConfig({})).toBeNull();
    expect(resolvePlannerConfig(undefined)).toBeNull();
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: '' })).toBeNull();
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: 42 })).toBeNull();
  });

  it('accepts a same-origin path', () => {
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: '/api/plan' })).toEqual({ endpoint: '/api/plan' });
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: '  /api/plan  ' })).toEqual({ endpoint: '/api/plan' });
  });

  it('rejects absolute URLs, even https (only same-origin paths are allowed)', () => {
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: 'https://example.com/api/plan' })).toBeNull();
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: 'https://api.vendor.example/v1/messages' })).toBeNull();
  });

  it('keeps accepting a same-origin path', () => {
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: '/api/plan' })).toEqual({
      endpoint: '/api/plan',
    });
  });

  it.each([
    'http://example.com/api/plan',
    'javascript:alert(1)',
    'data:text/plain,hi',
    'ftp://example.com',
    '//evil.example.com/plan',
    'api/plan',
    'https://user:pass@example.com/plan',
    '/api/plan with space',
    '/\\evil.example.com',
  ])('rejects %s', (value) => {
    expect(resolvePlannerConfig({ VITE_PLANNER_ENDPOINT: value })).toBeNull();
  });

  it('ignores every other variable', () => {
    expect(resolvePlannerConfig({ VITE_OTHER_ENDPOINT: '/api/plan' })).toBeNull();
  });
});

describe('getActiveProvider', () => {
  it('uses the demo provider without config', () => {
    expect(getActiveProvider(null)).toBe(demoProvider);
  });

  it('uses the HTTP provider when an endpoint is set', () => {
    const provider = getActiveProvider({ endpoint: '/api/plan' });
    expect(provider.id).toBe('http');
    expect(provider.source).toBe('ai');
  });
});

describe('secret guard', () => {
  // Everything Vite bundles is public, so no VITE_ variable may look like a credential.
  const files = import.meta.glob('/src/taskflow/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('reads the source files', () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
  });

  it('has no VITE_ identifier that names a key, secret or token', () => {
    const forbidden = ['KEY', 'SECRET', 'TOKEN'];
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(files)) {
      for (const [name] of source.matchAll(/VITE_[A-Za-z0-9_]*/g)) {
        if (forbidden.some((word) => name.toUpperCase().includes(word))) offenders.push(`${path}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
