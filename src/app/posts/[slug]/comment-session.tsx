"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession, type SessionView } from "@/lib/use-session";

const Context = createContext<SessionView>({ status: "loading", profile: null });
export function CommentSession({ children }: { children: ReactNode }) {
  const session = useSession();
  return <Context.Provider value={session}>{children}</Context.Provider>;
}
export function useCommentSession() { return useContext(Context); }
