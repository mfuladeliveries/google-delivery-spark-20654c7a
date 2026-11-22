/** Run screen refreshes only while visible/online, without overlapping requests. */
export function startVisibleRefresh(
  refresh: () => void | Promise<unknown>,
  intervalMs: number,
  { immediate = true }: { immediate?: boolean } = {},
) {
  let stopped = false;
  let pageHidden = false;
  let running = false;
  let resumePending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const active = () => !stopped && !pageHidden && !document.hidden && navigator.onLine;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    clear();
    if (active()) timer = setTimeout(() => void run(), intervalMs);
  };
  const run = async () => {
    if (!active()) return;
    if (running) { resumePending = true; return; }
    clear();
    running = true;
    try { await refresh(); }
    catch { /* Keep the existing loader's error handling; retry next interval. */ }
    finally {
      running = false;
      if (resumePending && active()) {
        resumePending = false;
        void run();
      } else {
        resumePending = false;
        schedule();
      }
    }
  };
  const sync = () => {
    clear();
    if (active()) void run();
  };
  const hide = () => { pageHidden = true; clear(); };
  const show = () => { pageHidden = false; sync(); };
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", hide);
  window.addEventListener("pageshow", show);
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  if (immediate) void run();
  else schedule();
  return () => {
    stopped = true;
    clear();
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pagehide", hide);
    window.removeEventListener("pageshow", show);
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", sync);
  };
}