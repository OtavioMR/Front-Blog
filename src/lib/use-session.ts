"use client";

import { useEffect, useState } from "react";
import { getOwnProfile, subscribeProfile, subscribeSession, type OwnProfile } from "./session-client";

export type SessionView = { status: "loading" | "signed-in" | "signed-out" | "error"; profile: OwnProfile | null };

// Single source for UI that mirrors the session (header, menus). The API remains the authority:
// the profile is always confirmed by an authenticated request, never inferred from local flags.
export function useSession(): SessionView {
  const [view, setView] = useState<SessionView>({ status: "loading", profile: null });
  useEffect(() => {
    let active = true;
    let revision = 0;
    function load() {
      const current = ++revision;
      getOwnProfile()
        .then(profile => { if (active && current === revision) setView(profile ? { status: "signed-in", profile } : { status: "signed-out", profile: null }); })
        // A transient failure must not look like a logout: keep the last known state.
        .catch(() => { if (active && current === revision) setView(previous => previous.profile ? previous : { status: "error", profile: null }); });
    }
    const stopSession = subscribeSession(load);
    const stopProfile = subscribeProfile(load);
    load();
    return () => { active = false; revision++; stopSession(); stopProfile(); };
  }, []);
  return view;
}