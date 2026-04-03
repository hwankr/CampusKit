import { useI18n } from "../../shared/i18n/useI18n";
import type { ToolDescriptor } from "../tools/toolRegistry";

type PlaceholderToolPageProps = {
  tool: ToolDescriptor;
};

export function PlaceholderToolPage({ tool }: PlaceholderToolPageProps) {
  const { t } = useI18n();

  return (
    <section className="placeholder-workspace">
      <div className="placeholder-card placeholder-hero">
        <div>
          <div className="section-badge">{t("statusPlanned")}</div>
          <h2 className="section-title">{t(tool.titleKey)}</h2>
          <p className="section-copy">{t(tool.descriptionKey)}</p>
        </div>

        <div className="placeholder-chipRow">
          <span className="split-mockChip">{t("appTitle")}</span>
        </div>
      </div>

      <div className="placeholder-grid">
        <article className="placeholder-card secondary-panel">
          <h3 className="split-panelTitle">{t(tool.navLabelKey)}</h3>
          <p className="section-copy">{t("placeholderBody")}</p>
        </article>

        <article className="placeholder-card">
          <h3 className="split-panelTitle">{t("appTitle")}</h3>
          <p className="placeholder-note">{t(tool.descriptionKey)}</p>
        </article>
      </div>
    </section>
  );
}
