import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCapture, listCaptures } from './client';

function mockFetchOnce(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('web api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createCapture POSTs to /captures with the DTO as JSON and returns the parsed response', async () => {
    const capture = {
      id: '1',
      source: 'manual',
      task: null,
      rawText: 'hello',
      status: 'raw',
      createdAt: '2026-07-18T00:00:00.000Z',
    };
    const fetchMock = mockFetchOnce(capture, { status: 201 });

    const result = await createCapture({ source: 'manual', rawText: 'hello' });

    expect(result).toEqual(capture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3000/captures');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body as string)).toEqual({ source: 'manual', rawText: 'hello' });
  });

  it('listCaptures GETs /captures with no query string when status is omitted', async () => {
    const fetchMock = mockFetchOnce([]);

    await listCaptures();

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe('http://localhost:3000/captures');
  });

  it('listCaptures appends ?status= only when a status is given', async () => {
    const fetchMock = mockFetchOnce([]);

    await listCaptures('raw');

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.toString()).toBe('http://localhost:3000/captures?status=raw');
  });

  it('rejects with an Error when the response is not ok', async () => {
    mockFetchOnce({ message: 'rawText should not be empty' }, { status: 400 });

    await expect(createCapture({ source: 'manual', rawText: '' })).rejects.toThrow(/400/);
  });
});
