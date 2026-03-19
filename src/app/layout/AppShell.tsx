import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  main: ReactNode;
};

export function AppShell({ sidebar, header, main }: AppShellProps) {
  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="app-sidebar">{sidebar}</aside>
        <section className="app-content">
          <header className="app-header">{header}</header>
          <div className="app-main">{main}</div>
        </section>
      </div>
    </div>
  );
}
