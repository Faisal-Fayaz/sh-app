/**
 * First-run flag resolution.
 *
 * Kept free of React Native and SecureStore imports so the node test scripts can
 * exercise it directly, which matters because the interesting case -- deciding
 * what an install that predates these flags should see -- is exactly the one
 * that cannot be checked by hand on a device that already has them set.
 */

export type StoredFlag = string | null;

/**
 * Decide whether a seen-* flag is set.
 *
 * A missing flag belongs to an install that predates it. If that install is
 * already paired, the user has demonstrably got an agent running, so showing
 * them the install walkthrough would explain the thing they have already done.
 * Any explicit value wins: a user who deliberately saw the tour is not shown it
 * again just because they are connected.
 */
export function resolveSeenFlag(stored: StoredFlag, alreadyPaired: boolean): boolean {
  if (stored === null) return alreadyPaired;
  return stored === "true";
}
