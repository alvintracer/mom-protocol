/**
 * Official momment. account handle.
 * Posts from this account can be pinned to the top of the home feed.
 */
export const OFFICIAL_HANDLE = "user_24a90b1ffb";

/** Check if a handle belongs to the official momment. account */
export function isOfficialAccount(handle: string | null | undefined): boolean {
  return handle === OFFICIAL_HANDLE;
}
