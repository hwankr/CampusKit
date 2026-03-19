import { useI18n } from "../../../shared/i18n/useI18n";
import type { PageSegment } from "../model/pageRange";

type SplitSummaryPanelProps = {
  documentName: string;
  pageCount: number | null;
  previewFiles: string[];
  segments: PageSegment[];
  statusTone: "idle" | "success" | "error" | "running";
  statusMessage: string;
};

export function SplitSummaryPanel({
  documentName,
  pageCount,
  previewFiles,
  segments,
  statusTone,
  statusMessage,
}: SplitSummaryPanelProps) {
  const { t } = useI18n();

  return (
    <section className="panel-card secondary-panel">
      <div className="section-badge">{t("pdfSplitSummaryBadge")}</div>
      <h2 className="section-title">{t("pdfSplitSummaryTitle")}</h2>
      <p className="section-copy">{t("pdfSplitSummaryBody")}</p>

      <div className="summary-metrics">
        <div className="metric-card">
          <span className="metric-label">{t("summaryDocumentLabel")}</span>
          <strong>{documentName || t("summaryPendingValue")}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">{t("summaryPageCountLabel")}</span>
          <strong>{pageCount ?? "-"}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">{t("summaryOutputCountLabel")}</span>
          <strong>{segments.length}</strong>
        </div>
      </div>

      <div className="status-card" data-tone={statusTone}>
        {statusMessage}
      </div>

      <div className="preview-list">
        {previewFiles.length === 0 ? (
          <div className="preview-empty">{t("summaryEmptyState")}</div>
        ) : (
          previewFiles.map((fileName, index) => (
            <div key={fileName} className="preview-item">
              <div>
                <div className="preview-label">{fileName}</div>
                <div className="preview-meta">
                  {segments[index]?.label} · {segments[index]?.pageCount} {t("summaryPagesUnit")}
                </div>
              </div>
              <span className="preview-index">{String(index + 1).padStart(2, "0")}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
