import { useState } from "react";
import { useI18n } from "../../shared/i18n/useI18n";

type ViewMode = "empty" | "demo";

type PdfSplitPageProps = {
  initialMode?: ViewMode;
};

type MockThumbnail = {
  page: string;
  title: string;
  note: string;
};

type MockRange = {
  range: string;
  pages: string;
  fileName: string;
  note: string;
};

const mockDocument = {
  name: "CampusKit-handbook.pdf",
  pages: 18,
  outputs: 4,
  focus: "Pages 5-8",
};

const mockThumbnails: MockThumbnail[] = [
  { page: "01", title: "Cover", note: "Title and visual index" },
  { page: "05", title: "Policy", note: "Split focus begins here" },
  { page: "09", title: "Checklist", note: "Middle section sample" },
  { page: "15", title: "Appendix", note: "Back matter sample" },
];

const mockRanges: MockRange[] = [
  {
    range: "1-4",
    pages: "4 pages",
    fileName: "CampusKit-handbook-split-01.pdf",
    note: "Intro and cover pages",
  },
  {
    range: "5-8",
    pages: "4 pages",
    fileName: "CampusKit-handbook-split-02.pdf",
    note: "Policy section for review",
  },
  {
    range: "9-14",
    pages: "6 pages",
    fileName: "CampusKit-handbook-split-03.pdf",
    note: "Operational checklist block",
  },
  {
    range: "15-18",
    pages: "4 pages",
    fileName: "CampusKit-handbook-split-04.pdf",
    note: "Appendix and references",
  },
];

export function PdfSplitPage({ initialMode = "empty" }: PdfSplitPageProps) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const isDemo = viewMode === "demo";

  return (
    <section className="split-stage" data-view={viewMode}>
      <div className="panel-card split-stageCard">
        <div className="split-stageIntro">
          <div>
            <div className="section-badge">{t("pdfSplitMockBadge")}</div>
            <h2 className="section-title">{t("pdfSplitMockTitle")}</h2>
            <p className="section-copy">{t("pdfSplitMockBody")}</p>
          </div>
          <div className="split-inlineNotice">{t("pdfSplitMockNotice")}</div>
        </div>

        <div className="split-stageGrid">
          <div className="split-dropzone" data-slot="dropzone" data-empty={!isDemo}>
            <div className="split-dropzoneBadge">PDF</div>
            <h3 className="split-panelTitle">{t("pdfSplitDropzoneTitle")}</h3>
            <p className="split-panelCopy">{t("pdfSplitDropzoneBody")}</p>

            <div className="split-stageActions">
              <button type="button" className="primary-button" onClick={() => setViewMode("demo")}>
                {t("pdfSplitDemoAction")}
              </button>
              <button type="button" className="ghost-button" onClick={() => setViewMode("empty")}>
                {t("pdfSplitResetAction")}
              </button>
            </div>

            <div className="split-dropzoneMeta">
              <span>{t("pdfSplitDropzoneAction")}</span>
              <strong>{isDemo ? mockDocument.name : t("summaryPendingValue")}</strong>
            </div>
          </div>

          <div className="split-flowCard">
            <span className="field-label">{t("pdfSplitFlowTitle")}</span>
            <ol className="split-flowList">
              <li>{t("pdfSplitFlowChoose")}</li>
              <li>{t("pdfSplitFlowInspect")}</li>
              <li>{t("pdfSplitFlowRange")}</li>
              <li>{t("pdfSplitFlowSave")}</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="split-workspaceGrid">
        <div className="split-sidebarColumn">
          <section className="panel-card split-infoPanel" data-empty={!isDemo}>
            <div className="section-badge">{t("summaryDocumentLabel")}</div>
            <h3 className="split-panelTitle">{t("pdfSplitDocTitle")}</h3>

            {isDemo ? (
              <>
                <strong className="split-documentName">{mockDocument.name}</strong>
                <div className="split-metricGrid">
                  <div className="metric-card">
                    <span className="metric-label">{t("summaryPageCountLabel")}</span>
                    <strong>{mockDocument.pages}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("summaryOutputCountLabel")}</span>
                    <strong>{mockDocument.outputs}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("pdfSplitDocFocusLabel")}</span>
                    <strong>{mockDocument.focus}</strong>
                  </div>
                </div>
              </>
            ) : (
              <p className="split-emptyCopy">{t("pdfSplitDocEmpty")}</p>
            )}
          </section>

          <section className="panel-card split-rangesPanel" data-slot="ranges-panel" data-empty={!isDemo}>
            <div className="section-badge">{t("pdfSplitRangesTitle")}</div>
            <h3 className="split-panelTitle">{t("pdfSplitRangesTitle")}</h3>

            {isDemo ? (
              <div className="split-rangeList">
                {mockRanges.map((item, index) => (
                  <article key={item.fileName} className="split-rangeCard">
                    <div className="split-rangeHeader">
                      <span className="split-rangeIndex">{String(index + 1).padStart(2, "0")}</span>
                      <span className="split-rangePill">{item.range}</span>
                    </div>
                    <strong className="preview-label">{item.fileName}</strong>
                    <div className="preview-meta">{item.pages}</div>
                    <p className="split-rangeNote">{item.note}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="split-emptyCopy">{t("pdfSplitRangesEmpty")}</p>
            )}
          </section>

          <section className="panel-card split-savePanel" data-slot="save-placeholder">
            <div className="split-saveHeader">
              <div>
                <div className="section-badge">{t("pdfSplitSaveTitle")}</div>
                <h3 className="split-panelTitle">{t("pdfSplitSaveTitle")}</h3>
              </div>
              <span className="split-mockChip">{t("pdfSplitMockChip")}</span>
            </div>
            <p className="split-panelCopy">{t("pdfSplitSaveBody")}</p>
            <button type="button" className="primary-button" disabled>
              {t("pdfSplitSaveAction")}
            </button>
          </section>
        </div>

        <section className="panel-card split-previewPanel" data-slot="preview-panel" data-empty={!isDemo}>
          <div className="split-previewHeader">
            <div>
              <div className="section-badge">{t("pdfSplitPreviewTitle")}</div>
              <h3 className="split-panelTitle">{t("pdfSplitPreviewTitle")}</h3>
            </div>
            {isDemo ? <span className="split-mockChip">{t("pdfSplitPreviewCaption")}</span> : null}
          </div>

          <div className="split-previewCanvas">
            {isDemo ? (
              <>
                <div className="split-previewPage">
                  <span className="split-previewPageNumber">05</span>
                  <span className="split-previewPageLabel">Policy Section</span>
                </div>
                <div className="split-previewOverlay">
                  <strong>Pages 5-8</strong>
                  <span>{t("pdfSplitPreviewCaption")}</span>
                </div>
              </>
            ) : (
              <div className="split-previewEmpty">
                <strong>{t("pdfSplitPreviewEmpty")}</strong>
                <p>{t("pdfSplitMockNotice")}</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel-card secondary-panel split-thumbnailPanel" data-slot="thumbnail-rail" data-empty={!isDemo}>
          <div className="section-badge">{t("pdfSplitThumbTitle")}</div>
          <h3 className="split-panelTitle">{t("pdfSplitThumbTitle")}</h3>

          {isDemo ? (
            <div className="split-thumbnailList">
              {mockThumbnails.map((item) => (
                <div key={item.page} className="split-thumbnailCard">
                  <div className="split-thumbnailFrame">{item.page}</div>
                  <div>
                    <strong>{item.title}</strong>
                    <div className="preview-meta">{item.note}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="split-emptyCopy">{t("pdfSplitThumbEmpty")}</p>
          )}
        </section>
      </div>
    </section>
  );
}
