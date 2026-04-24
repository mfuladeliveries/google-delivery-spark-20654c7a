// Persist the React Query cache to localStorage so that when the user
// returns from background (or relaunches the installed PWA), restaurants,
// menus and other already-fetched data are available INSTANTLY without a
// loading spinner. Stale data is revalidated in the background.

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 60s — prevents an aggressive refetch storm
      // every time the tab regains focus.
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24, // keep in cache for a day
      // We DO want a background refresh on focus for things like order
      // status, but it must not block the UI. React Query handles this
      // correctly when staleTime is set — it returns cached data instantly
      // and revalidates silently.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

export const queryPersister =
  typeof window !== "undefined"
    ? createSyncStoragePersister({
        storage: window.localStorage,
        key: "mfula-query-cache",
        throttleTime: 1000,
      })
    : undefined;
