"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

export type RobotState = "idle" | "listening" | "thinking" | "talking";

const RobotScene = dynamic(() => import("./robot-scene"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="robot-scene-container" />,
});

type AIRobotProps = {
  started: boolean;
  state: RobotState;
};

export default function AIRobot({ started, state }: AIRobotProps) {
  const [isUnsupported, setIsUnsupported] = useState(false);
  const handleUnsupported = useCallback(() => setIsUnsupported(true), []);

  if (isUnsupported) {
    return (
      <div
        aria-label="Assistant Aether"
        className="robot-fallback"
        data-state={state}
      >
        <div className="robot-fallback-core" />
      </div>
    );
  }

  return (
    <RobotScene
      active={started}
      onUnsupported={handleUnsupported}
      state={state}
    />
  );
}