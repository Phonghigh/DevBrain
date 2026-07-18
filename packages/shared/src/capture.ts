/**
 * The 3 states a Capture moves through (spec §5 `Capture.status`, spec §6.4).
 * Raw -> distilled once a Concept is authored from it; archived is a manual
 * dismissal (not wired up until later, but the shape allows for it now).
 */
export type CaptureStatus = 'raw' | 'distilled' | 'archived';

/** What `POST /captures` accepts (spec §6.1) — id/status/createdAt are server-assigned. */
export interface CreateCaptureDto {
  source: string;
  task?: string;
  rawText: string;
}

/** What the api returns for a Capture. `createdAt` is an ISO string (crosses JSON). */
export interface CaptureDto {
  id: string;
  source: string;
  task: string | null;
  rawText: string;
  status: CaptureStatus;
  createdAt: string;
}
