"use client";

import { createContext, useContext, useEffect, useState } from "react";

type SidebarContextType = {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  // False until the saved collapse state has been read on the client. Consumers
  // use it to skip width/padding transitions on the very first paint so the
  // sidebar doesn't visibly slide from expanded → collapsed on every load.
  ready: boolean;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("date-sidebar-collapsed");
    if (saved) {
      setIsCollapsed(JSON.parse(saved));
    }
    setReady(true);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("date-sidebar-collapsed", JSON.stringify(next));
      return next;
    });
  };

  // Server always renders isCollapsed=false (no localStorage), so the first
  // client paint matches; `ready` then lets consumers apply the saved width
  // instantly (no transition) instead of animating the correction.
  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, ready }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};
