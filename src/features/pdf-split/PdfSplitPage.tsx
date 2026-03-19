import { useEffect, useState } from "react";
import type { MessageKey } from "../../shared/i18n/messages/ko";
import { useI18n } from "../../shared/i18n/useI18n";
import { getFileName } from "../../shared/platform/path";
import { parsePageRangeInput, type PageSegment } from "./model/pageRange";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./model/splitJob";
import { pdfSplitService } from "./service/pdfSplitService";

type StatusState =
  | { tone: "idle"; message: string }
  | { tone: "running"; message: string }
  | { tone: "success"; message: string }
  | { tone: "error"; message: string };

type RangeEntry = {
  fileName: string;
  outputPath: string | null;
  segment: PageSegment;
};

export function PdfSplitPage() {
  const { t } = useI18n();
  const [inputPath, setInputPath] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageRangeText, setPageRangeText] = useState("");
  const [segments, setSegments] = useState<PageSegment[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState(0);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: t("statusAwaitingSetup"),
  });

  function buildIdleStatus(currentPageCount: number | null): StatusState {
    return {
      tone: "idle",
      message: currentPageCount !== null ? t("statusReadyForRange") : t("statusAwaitingSetup"),
    };
  }

  useEffect(() => {
    if (!pageRangeText.trim() || pageCount === null) {
      setSegments([]);
      setValidationMessage(null);
      setSelectedRangeIndex(0);
      return;
    }

    try {
      const nextSegments = parsePageRangeInput(pageRangeText, pageCount);
      setSegments(nextSegments);
      setValidationMessage(null);
      setSelectedRangeIndex((currentIndex) =>
        Math.min(currentIndex, Math.max(nextSegments.length - 1, 0)),
      );
    } catch (error) {
      const errorKey: MessageKey =
        error instanceof Error ? (error.message as MessageKey) : "statusUnknownError";
      setSegments([]);
      setValidationMessage(t(errorKey));
      setSelectedRangeIndex(0);
    }
  }, [pageCount, pageRangeText, t]);

  const expectedFiles = segments.map((segment, index) =>
    buildPreviewFileName(deriveSplitBaseName(documentName || inputPath), segment, index),
  );

  const rangeEntries: RangeEntry[] = segments.map((segment, index) => ({
    segment,
    fileName: outputFiles[index] ? getFileName(outputFiles[index]) : expectedFiles[index],
    outputPath: outputFiles[index] ?? null,
  }));

  const selectedEntry = rangeEntries[selectedRangeIndex] ?? null;

  const canSubmit =
    Boolean(inputPath) &&
    Boolean(outputDir) &&
    pageCount !== null &&
    segments.length > 0 &&
    !validationMessage &&
    status.tone !== "running";

  async function handleChooseInput() {
    const selectedPath = await pdfSplitService.pickPdfFile();
    if (!selectedPath) {
      return;
    }

    try {
      const metadata = await pdfSplitService.getPdfMetadata(selectedPath);
      setInputPath(selectedPath);
      setDocumentName(metadata.fileName);
      setPageCount(metadata.pageCount);
      setPageRangeText("");
      setSegments([]);
      setOutputFiles([]);
      setValidationMessage(null);
      setSelectedRangeIndex(0);
      setStatus(buildIdleStatus(metadata.pageCount));
    } catch {
      setStatus({
        tone: "error",
        message: t("statusMetadataError"),
      });
    }
  }

  async function handleChooseOutput() {
    const selectedPath = await pdfSplitService.pickOutputDirectory();
    if (!selectedPath) {
      return;
    }

    setOutputDir(selectedPath);
    setOutputFiles([]);
    setStatus(buildIdleStatus(pageCount));
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setStatus({
      tone: "running",
      message: t("statusSplitRunning"),
    });

    try {
      const response = await pdfSplitService.splitPdf(
        toSplitRequestPayload(inputPath, outputDir, segments),
      );
      setOutputFiles(response.outputFiles);
      setStatus({
        tone: "success",
        message: t("statusSplitSuccess"),
      });
    } catch {
      setStatus({
        tone: "error",
        message: t("statusSplitError"),
      });
    }
  }

  function handleRangeChange(value: string) {
    setPageRangeText(value);
    setOutputFiles([]);

    if (status.tone !== "running") {
      setStatus(buildIdleStatus(pageCount));
    }
  }

  return (
    <section className="split-stage" data-live-state={inputPath ? "loaded" : "empty"}>
      <div className="panel-card split-stageCard">
        <div className="split-stageIntro">
          <div>
            <div className="section-badge">{t("pdfSplitFormBadge")}</div>
            <h2 className="section-title">{t("pdfSplitFormTitle")}</h2>
            <p className="section-copy">{t("pdfSplitFormBody")}</p>
          </div>
          <div className="split-inlineNotice">{t("pdfSplitWorkspaceNotice")}</div>
        </div>

        <div className="split-stageGrid">
          <div className="split-dropzone" data-slot="dropzone" data-empty={!inputPath}>
            <div className="split-dropzoneBadge">PDF</div>
            <h3 className="split-panelTitle">{t("inputFileLabel")}</h3>
            <p className="split-panelCopy">{t("pdfSplitIntakeBody")}</p>

            <div className="split-stageActions">
              <button type="button" className="primary-button" onClick={handleChooseInput}>
                {t("browseFileAction")}
              </button>
            </div>

            <div className="split-dropzoneMeta">
              <span>{t("inputFileLabel")}</span>
              <strong>{documentName || t("summaryPendingValue")}</strong>
            </div>
          </div>

          <div className="split-flowCard" data-slot="setup-panel">
            <span className="field-label">{t("pdfSplitSetupTitle")}</span>
            <p className="split-panelCopy split-setupCopy">{t("pdfSplitSetupBody")}</p>

            <div className="field-grid split-configFields">
              <label className="field-block">
                <span className="field-label">{t("outputDirLabel")}</span>
                <div className="field-row">
                  <input
                    className="field-input"
                    value={outputDir}
                    readOnly
                    placeholder={t("outputDirPlaceholder")}
                  />
                  <button type="button" className="ghost-button" onClick={handleChooseOutput}>
                    {t("browseFolderAction")}
                  </button>
                </div>
              </label>

              <label className="field-block">
                <span className="field-label">{t("pageRangeLabel")}</span>
                <textarea
                  className="field-textarea"
                  value={pageRangeText}
                  onChange={(event) => handleRangeChange(event.currentTarget.value)}
                  placeholder={t("pageRangePlaceholder")}
                  rows={4}
                />
              </label>
            </div>

            {validationMessage ? <div className="validation-banner">{validationMessage}</div> : null}

            <div className="status-card" data-tone={status.tone}>
              {status.message}
            </div>

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
          <section className="panel-card split-infoPanel" data-slot="document-info" data-empty={!inputPath}>
            <div className="section-badge">{t("summaryDocumentLabel")}</div>
            <h3 className="split-panelTitle">{t("pdfSplitDocTitle")}</h3>

            {inputPath ? (
              <>
                <strong className="split-documentName">{documentName || getFileName(inputPath)}</strong>
                <div className="split-metricGrid">
                  <div className="metric-card">
                    <span className="metric-label">{t("summaryPageCountLabel")}</span>
                    <strong>{pageCount ?? "-"}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("summaryOutputCountLabel")}</span>
                    <strong>{segments.length}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("pdfSplitDocFocusLabel")}</span>
                    <strong>{selectedEntry ? selectedEntry.segment.label : t("summaryPendingValue")}</strong>
                  </div>
                  <div className="metric-card">
                    <span className="metric-label">{t("outputDirLabel")}</span>
                    <strong>{outputDir || t("summaryPendingValue")}</strong>
                  </div>
                </div>
              </>
            ) : (
              <p className="split-emptyCopy">{t("pdfSplitDocEmpty")}</p>
            )}
          </section>

          <section className="panel-card split-rangesPanel" data-slot="ranges-panel" data-empty={rangeEntries.length === 0}>
            <div className="section-badge">{t("pdfSplitRangesTitle")}</div>
            <h3 className="split-panelTitle">{t("pdfSplitRangesTitle")}</h3>

            {rangeEntries.length > 0 ? (
              <div className="split-rangeList">
                {rangeEntries.map((entry, index) => (
                  <article key={`${entry.segment.label}-${index}`} className="split-rangeCard">
                    <div className="split-rangeHeader">
                      <span className="split-rangeIndex">{String(index + 1).padStart(2, "0")}</span>
                      <span className="split-rangePill">{entry.segment.label}</span>
                    </div>
                    <strong className="preview-label">{entry.fileName}</strong>
                    <div className="preview-meta">
                      {`${entry.segment.pageCount} ${t("summaryPagesUnit")} / ${
                        entry.outputPath ? t("pdfSplitSavedOutputLabel") : t("pdfSplitExpectedOutputLabel")
                      }`}
                    </div>
                    <p className="split-rangeNote">
                      {entry.outputPath ?? t("pdfSplitPreviewHintEmpty")}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="split-emptyCopy">{t("pdfSplitRangesEmpty")}</p>
            )}
          </section>

          <section className="panel-card split-savePanel" data-slot="save-action">
            <div className="split-saveHeader">
              <div>
                <div className="section-badge">{t("pdfSplitSaveTitle")}</div>
                <h3 className="split-panelTitle">{t("pdfSplitSaveTitle")}</h3>
              </div>
              <span className="split-mockChip">{t("pdfSplitMockChip")}</span>
            </div>
            <p className="split-panelCopy">{t("pdfSplitSaveBody")}</p>
            <button
              type="button"
              className="primary-button"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {status.tone === "running" ? t("splitRunningAction") : t("splitSubmitAction")}
            </button>
          </section>
        </div>

        <section className="panel-card split-previewPanel" data-slot="preview-panel" data-empty={!selectedEntry}>
          <div className="split-previewHeader">
            <div>
              <div className="section-badge">{t("pdfSplitPreviewTitle")}</div>
              <h3 className="split-panelTitle">{t("pdfSplitPreviewTitle")}</h3>
            </div>
            {selectedEntry ? <span className="split-mockChip">{t("pdfSplitPreviewCaption")}</span> : null}
          </div>

          <div className="split-previewCanvas">
            {selectedEntry ? (
              <>
                <div className="split-previewPage">
                  <span className="split-previewPageNumber">{selectedEntry.segment.start}</span>
                  <span className="split-previewPageLabel">{selectedEntry.fileName}</span>
                </div>
                <div className="split-previewOverlay">
                  <strong>{selectedEntry.segment.label}</strong>
                  <span>{`${selectedEntry.segment.pageCount} ${t("summaryPagesUnit")}`}</span>
                </div>
              </>
            ) : (
              <div className="split-previewEmpty">
                <strong>{t("pdfSplitPreviewEmpty")}</strong>
                <p>{t("pdfSplitPreviewHintEmpty")}</p>
              </div>
            )}
          </div>
        </section>

        <section className="panel-card secondary-panel split-thumbnailPanel" data-slot="thumbnail-rail" data-empty={rangeEntries.length === 0}>
          <div className="section-badge">{t("pdfSplitThumbTitle")}</div>
          <h3 className="split-panelTitle">{t("pdfSplitThumbTitle")}</h3>

          {rangeEntries.length > 0 ? (
            <div className="split-thumbnailList">
              {rangeEntries.map((entry, index) => (
                <button
                  key={`${entry.segment.label}-thumb`}
                  type="button"
                  className={`split-thumbnailCard${selectedRangeIndex === index ? " is-selected" : ""}`}
                  onClick={() => setSelectedRangeIndex(index)}
                >
                  <div className="split-thumbnailFrame">{String(entry.segment.start).padStart(2, "0")}</div>
                  <div>
                    <strong>{entry.segment.label}</strong>
                    <div className="preview-meta">{entry.fileName}</div>
                  </div>
                </button>
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
