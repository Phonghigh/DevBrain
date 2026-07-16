import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { InboxRoute } from './routes/InboxRoute';
import { DistillRoute } from './routes/DistillRoute';
import { BrowseRoute } from './routes/BrowseRoute';

/** Top nav + the slot every route renders into. */
function AppLayout() {
  return (
    <>
      <nav>
        <NavLink to="/inbox">Inbox</NavLink> <NavLink to="/distill">Distill</NavLink>{' '}
        <NavLink to="/browse">Browse</NavLink>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
}

/**
 * The route table. Kept free of a Router provider so tests can mount it inside a
 * MemoryRouter (DB0-10) while main.tsx mounts it inside a BrowserRouter.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<InboxRoute />} />
        <Route path="distill" element={<DistillRoute />} />
        <Route path="browse" element={<BrowseRoute />} />
      </Route>
    </Routes>
  );
}
