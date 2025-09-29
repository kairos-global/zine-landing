"use client";

import { useState } from "react";
import clsx from "clsx";

import { InteractivityView } from "./interactivity"; // named export from interactivity/index.ts
import { CanvasView } from "./canvas"; // named export from canvas/index.ts

type TabKey = "INTERACTIVITY" | "CANVAS";

interface TabsProps {
  defaultTab?: TabKey;
  onChange?: (tab: TabKey) => void;
}

const TABS: Record<TabKey, string> = {
  INTERACTIVITY: "Interactivity",
  CANVAS: "Canvas",
};

export default function Tabs({ defaultTab = "INTERACTIVITY", onChange }: TabsProps) {
  const [active, setActive] = useState<TabKey>(defaultTab);

  const handleTabClick = (tab: TabKey) => {
    setActive(tab);
    if (onChange) onChange(tab);
  };

  return (
    <div className="mb-6">
      {/* Tab header buttons */}
      <div className="flex gap-2 border-b border-gray-300">
        {Object.entries(TABS).map(([key, label]) => {
          const tabKey = key as TabKey;
          const isActive = active === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => handleTabClick(tabKey)}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-t-lg border",
                isActive
                  ? "bg-white border-gray-300 border-b-transparent"
                  : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {active === "INTERACTIVITY" && <InteractivityView />}
        {active === "CANVAS" && <CanvasView />}
      </div>
    </div>
  );
}
