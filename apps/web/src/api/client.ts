import type { CaptureDto, CaptureStatus, CreateCaptureDto } from '@devbrain/shared';

// Falls back to the api's own default port (apps/api/src/main.ts) so the app works
// out of the box in local dev without requiring a .env file.
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000';

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API request failed: ${res.status} ${res.statusText} — ${body}`);
  }
  return (await res.json()) as T;
}

export async function createCapture(dto: CreateCaptureDto): Promise<CaptureDto> {
  const res = await fetch(`${API_BASE_URL}/captures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  return parseOrThrow<CaptureDto>(res);
}

export async function listCaptures(status?: CaptureStatus): Promise<CaptureDto[]> {
  const url = new URL(`${API_BASE_URL}/captures`);
  if (status) {
    url.searchParams.set('status', status);
  }
  const res = await fetch(url);
  return parseOrThrow<CaptureDto[]>(res);
}
