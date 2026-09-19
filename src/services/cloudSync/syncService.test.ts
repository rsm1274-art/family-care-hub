import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cloudSync } from './syncService';
import type { CloudProvider, CloudFile } from './types';

const makeMockProvider = (overrides: Partial<CloudProvider> = {}): CloudProvider => {
  let connected = false;
  const files = new Map<string, { content: string; modifiedTime: string }>();

  return {
    id: 'mock',
    label: 'Mock Provider',
    isConnected: () => connected,
    connect: vi.fn(async () => { connected = true; }),
    disconnect: vi.fn(async () => { connected = false; }),
    listFiles: vi.fn(async (): Promise<CloudFile[]> =>
      Array.from(files.entries()).map(([name, f]) => ({ name, modifiedTime: f.modifiedTime })),
    ),
    readFile: vi.fn(async (name: string) => files.get(name)?.content ?? null),
    writeFile: vi.fn(async (name: string, content: string) => {
      files.set(name, { content, modifiedTime: new Date().toISOString() });
    }),
    deleteFile: vi.fn(async (name: string) => { files.delete(name); }),
    ...overrides,
  };
};

describe('cloudSync', () => {
  beforeEach(async () => {
    localStorage.clear();
    await cloudSync.disconnect();
  });

  it('is disconnected by default', () => {
    expect(cloudSync.isConnected()).toBe(false);
  });

  it('connects a provider and marks it as the active one', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);
    expect(cloudSync.isConnected()).toBe(true);
    expect(cloudSync.getProvider()).toBe(provider);
  });

  it('pushAll writes every entry and stamps a synced-at marker', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);

    await cloudSync.pushAll({ a: 'sealed-a', b: 'sealed-b' });

    expect(provider.writeFile).toHaveBeenCalledWith('a', 'sealed-a');
    expect(provider.writeFile).toHaveBeenCalledWith('b', 'sealed-b');
    expect(localStorage.getItem('a__synced_at')).not.toBeNull();
    expect(localStorage.getItem('b__synced_at')).not.toBeNull();
  });

  it('pushAll is a no-op when nothing is connected', async () => {
    await expect(cloudSync.pushAll({ a: 'x' })).resolves.toBeUndefined();
  });

  it('pullNewer downloads a remote file newer than the local sync marker', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);
    await provider.writeFile('a', 'remote-content');

    const updated = await cloudSync.pullNewer(['a']);

    expect(updated).toEqual(['a']);
    expect(localStorage.getItem('a')).toBe('remote-content');
  });

  it('pullNewer skips a key whose local copy is already up to date', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);
    await cloudSync.pushAll({ a: 'sealed-a' });

    const updated = await cloudSync.pullNewer(['a']);

    expect(updated).toEqual([]);
  });

  it('pullNewer ignores keys with no remote file', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);

    const updated = await cloudSync.pullNewer(['missing']);

    expect(updated).toEqual([]);
  });

  it('pullNewer returns nothing when disconnected', async () => {
    await expect(cloudSync.pullNewer(['a'])).resolves.toEqual([]);
  });

  it('disconnect clears the active provider', async () => {
    const provider = makeMockProvider();
    await cloudSync.connect(provider);
    await cloudSync.disconnect();

    expect(cloudSync.isConnected()).toBe(false);
    expect(provider.disconnect).toHaveBeenCalled();
  });
});
