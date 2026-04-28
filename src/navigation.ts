type Unsubscribe = () => void;

const NAVIJS_LOCATIONCHANGE = "navijs:locationchange";

const SYM_ORIG_PUSH = Symbol.for("navijs.origPushState");
const SYM_ORIG_REPLACE = Symbol.for("navijs.origReplaceState");
const SYM_PATCHED = Symbol.for("navijs.historyPatched");

let refCount = 0;
let patched = false;

function dispatch(): void {
  window.dispatchEvent(new Event(NAVIJS_LOCATIONCHANGE));
}

function patchHistoryOnce(): void {
  if (patched) return;
  const history = window.history as History & {
    [SYM_PATCHED]?: boolean;
    [SYM_ORIG_PUSH]?: History["pushState"];
    [SYM_ORIG_REPLACE]?: History["replaceState"];
  };

  if (history[SYM_PATCHED]) {
    patched = true;
    return;
  }

  const currentPush = history.pushState.bind(history);
  const currentReplace = history.replaceState.bind(history);

  history[SYM_ORIG_PUSH] = currentPush;
  history[SYM_ORIG_REPLACE] = currentReplace;

  history.pushState = function (...args) {
    const r = currentPush(...(args as Parameters<History["pushState"]>));
    dispatch();
    return r;
  };
  history.replaceState = function (...args) {
    const r = currentReplace(...(args as Parameters<History["replaceState"]>));
    dispatch();
    return r;
  };

  history[SYM_PATCHED] = true;
  patched = true;
}

function maybeUnpatchHistory(): void {
  if (refCount !== 0) return;
  if (!patched) return;

  const history = window.history as History & {
    [SYM_PATCHED]?: boolean;
    [SYM_ORIG_PUSH]?: History["pushState"];
    [SYM_ORIG_REPLACE]?: History["replaceState"];
  };

  const origPush = history[SYM_ORIG_PUSH];
  const origReplace = history[SYM_ORIG_REPLACE];
  if (!origPush || !origReplace) return;

  // Only restore if the current methods are still our patched ones.
  // If some other code replaced them after us, don't clobber it.
  if (history[SYM_PATCHED]) {
    history.pushState = origPush;
    history.replaceState = origReplace;
    delete history[SYM_PATCHED];
    delete history[SYM_ORIG_PUSH];
    delete history[SYM_ORIG_REPLACE];
    patched = false;
  }
}

export function subscribeToLocationChange(cb: () => void): Unsubscribe {
  if (typeof window === "undefined") return () => {};

  refCount += 1;
  patchHistoryOnce();

  window.addEventListener("popstate", cb);
  window.addEventListener("hashchange", cb);
  window.addEventListener(NAVIJS_LOCATIONCHANGE, cb);

  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("hashchange", cb);
    window.removeEventListener(NAVIJS_LOCATIONCHANGE, cb);
    refCount = Math.max(0, refCount - 1);
    maybeUnpatchHistory();
  };
}

