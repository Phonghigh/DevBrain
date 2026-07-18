import type { CaptureDto } from '@devbrain/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxRoute } from './InboxRoute';
import { createCapture, listCaptures } from '../../api/client';

// Mocks the api client module (not fetch/network) — this test is about the screen's
// behavior, not re-proving DB1-05's client, which already has its own unit tests.
vi.mock('../../api/client', () => ({
  createCapture: vi.fn(),
  listCaptures: vi.fn(),
}));

const mockedCreateCapture = vi.mocked(createCapture);
const mockedListCaptures = vi.mocked(listCaptures);

function makeCapture(overrides: Partial<CaptureDto> = {}): CaptureDto {
  return {
    id: 'c1',
    source: 'manual',
    task: null,
    rawText: 'existing capture',
    status: 'raw',
    createdAt: '2026-07-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('InboxRoute', () => {
  beforeEach(() => {
    mockedListCaptures.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders its heading', async () => {
    // MemoryRouter keeps the URL in memory instead of touching a real address bar.
    // InboxRoute needs no routing today, but every route rendered here will once it
    // links or navigates — so this is the shape later render tests copy.
    render(
      <MemoryRouter>
        <InboxRoute />
      </MemoryRouter>,
    );

    // Query by role, not by CSS class or test id: this asserts the page is a real
    // heading to a screen reader, not just text that happens to look big.
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
    await waitFor(() => expect(mockedListCaptures).toHaveBeenCalledWith('raw'));
  });

  it('renders the raw captures returned by listCaptures on mount', async () => {
    mockedListCaptures.mockResolvedValue([makeCapture({ id: 'c1', rawText: 'first capture' })]);

    render(
      <MemoryRouter>
        <InboxRoute />
      </MemoryRouter>,
    );

    expect(await screen.findByText('first capture')).toBeInTheDocument();
  });

  it('paste -> Save -> the new capture appears in the list', async () => {
    const user = userEvent.setup();
    const created = makeCapture({ id: 'c2', source: 'chatgpt', rawText: 'a fresh paste' });
    mockedCreateCapture.mockResolvedValue(created);

    render(
      <MemoryRouter>
        <InboxRoute />
      </MemoryRouter>,
    );

    // Wait for the initial (empty) list load so it doesn't race the save below.
    await screen.findByText('No raw captures yet.');

    await user.selectOptions(screen.getByLabelText('Source'), 'chatgpt');
    await user.type(screen.getByLabelText('Raw text'), 'a fresh paste');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockedCreateCapture).toHaveBeenCalledWith({
      source: 'chatgpt',
      task: undefined,
      rawText: 'a fresh paste',
    });
    expect(await screen.findByText('a fresh paste')).toBeInTheDocument();
    // The form clears after a successful save, ready for the next paste.
    expect(screen.getByLabelText('Raw text')).toHaveValue('');
  });

  it('a failed save keeps what was typed instead of clearing it', async () => {
    const user = userEvent.setup();
    mockedCreateCapture.mockRejectedValue(new Error('API request failed: 400'));

    render(
      <MemoryRouter>
        <InboxRoute />
      </MemoryRouter>,
    );

    await screen.findByText('No raw captures yet.');
    await user.type(screen.getByLabelText('Raw text'), 'do not lose this');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i);
    expect(screen.getByLabelText('Raw text')).toHaveValue('do not lose this');
  });
});
