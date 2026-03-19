import type { ReactNode } from "react";

type MainPanelProps = {
  children: ReactNode;
};

export function MainPanel({ children }: MainPanelProps) {
  return <div className="workspace-panel">{children}</div>;
}
