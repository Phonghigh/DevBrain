import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { InboxRoute } from './InboxRoute';

describe('InboxRoute', () => {
  it('renders its heading', () => {
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
  });
});
