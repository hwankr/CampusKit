import { useI18n } from "../../shared/i18n/useI18n";
import type { ToolDescriptor } from "../tools/toolRegistry";

type PlaceholderToolPageProps = {
  tool: ToolDescriptor;
};

export function PlaceholderToolPage({ tool }: PlaceholderToolPageProps) {
  const { t } = useI18n();

  return (
    <section className="placeholder-card">
      <div className="section-badge">{t("statusPlanned")}</div>
      <h2 className="section-title">{t(tool.titleKey)}</h2>
      <p className="section-copy">{t(tool.descriptionKey)}</p>
      <p className="placeholder-note">{t("placeholderBody")}</p>
    </section>
  );
}
