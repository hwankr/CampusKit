import { useI18n } from "../../shared/i18n/useI18n";
import type { ToolDescriptor, ToolId } from "../../features/tools/toolRegistry";

type SidebarProps = {
  tools: ToolDescriptor[];
  activeToolId: ToolId;
  onSelectTool: (toolId: ToolId) => void;
};

export function Sidebar({ tools, activeToolId, onSelectTool }: SidebarProps) {
  const { t } = useI18n();

  return (
    <div className="sidebar-panel">
      <div className="sidebar-brand">
        <div className="sidebar-brandMark">CK</div>
        <div>
          <div className="sidebar-brandName">{t("appTitle")}</div>
          <div className="sidebar-brandMeta">{t("appTagline")}</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={t("sidebarAriaLabel")}>
        {tools.map((tool) => {
          const isActive = tool.id === activeToolId;

          return (
            <button
              key={tool.id}
              type="button"
              className={isActive ? "sidebar-item is-active" : "sidebar-item"}
              aria-pressed={isActive}
              onClick={() => onSelectTool(tool.id)}
            >
              <span className="sidebar-itemIcon" aria-hidden="true">
                {tool.icon}
              </span>
              <span className="sidebar-itemText">
                <span className="sidebar-itemLabel">{t(tool.navLabelKey)}</span>
                <span className="sidebar-itemStatus">
                  {tool.status === "active" ? t("statusReady") : t("statusPlanned")}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footnote">{t("sidebarFootnote")}</div>
    </div>
  );
}
