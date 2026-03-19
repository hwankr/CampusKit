import { useI18n } from "../../shared/i18n/useI18n";
import type { ToolDescriptor } from "../../features/tools/toolRegistry";

type AppHeaderProps = {
  tool: ToolDescriptor;
};

export function AppHeader({ tool }: AppHeaderProps) {
  const { t, locale } = useI18n();

  return (
    <div className="header-bar">
      <div>
        <div className="header-kicker">{t("headerKicker")}</div>
        <h1 className="header-title">{t(tool.titleKey)}</h1>
        <p className="header-subtitle">{t(tool.descriptionKey)}</p>
      </div>

      <div className="header-meta">
        <div className="header-chip">
          <span className="header-chipLabel">{t("headerLocaleLabel")}</span>
          <strong>{locale.toUpperCase()}</strong>
        </div>
        <div className="header-chip">
          <span className="header-chipLabel">{t("headerModeLabel")}</span>
          <strong>{tool.status === "active" ? t("statusReady") : t("statusPlanned")}</strong>
        </div>
      </div>
    </div>
  );
}
