import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  header?: ReactNode;
  main: ReactNode;
};

export function AppShell({ sidebar, header, main }: AppShellProps) {
  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="app-sidebar">{sidebar}</aside>
        <section className={header ? "app-content has-header" : "app-content"}>
          {header ? <header className="app-header">{header}</header> : null}
          <div className="app-main">{main}</div>
        </section>
      </div>
    </div>
  );
}
