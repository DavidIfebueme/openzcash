"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Only an in-memory flag crosses the shell boundary. No chat content or keys.
const ChatSessionContext = createContext<{
  active: boolean;
  setActive(active: boolean): void;
} | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const value = useMemo(() => ({ active, setActive }), [active]);
  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export const useChatSession = () => useContext(ChatSessionContext);
