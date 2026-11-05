import { create } from "zustand";
import { accountDbUrl, setActiveDb } from "./db";
import { markLogin } from "./accounts";
import { queryClient } from "./queryClient";
import { useNav } from "./nav";

const LAST_KEY = "lifeos.lastAccount";

export function lastAccountId(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function rememberAccount(id: number) {
  try {
    localStorage.setItem(LAST_KEY, String(id));
  } catch {
    // Only used to preselect the account next time.
  }
}

interface SessionState {
  /** Signed-in account, or null while the sign-in screen is showing. */
  accountId: number | null;
  /**
   * True once the user signed out or locked: the sign-in screen then stays up even for an
   * account without a password (which otherwise opens straight away at launch).
   */
  locked: boolean;
  signIn: (id: number) => void;
  /** Shows the sign-in screen, preselecting `nextId` when given (e.g. switching accounts). */
  signOut: (nextId?: number) => void;
}

export const useSession = create<SessionState>((set) => ({
  accountId: null,
  locked: false,
  signIn: (id) => {
    setActiveDb(accountDbUrl(id));
    // Nothing cached from the previous account may leak into this one.
    queryClient.clear();
    useNav.setState({ page: "today", tasksView: "list", settingsOpen: false });
    rememberAccount(id);
    void markLogin(id);
    set({ accountId: id, locked: false });
  },
  signOut: (nextId) => {
    if (nextId) rememberAccount(nextId);
    queryClient.clear();
    set({ accountId: null, locked: true });
  },
}));
