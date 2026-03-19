import { useEffect, useState } from "react";
import type { MessageKey } from "../../shared/i18n/messages/ko";
import { useI18n } from "../../shared/i18n/useI18n";
import { getFileName } from "../../shared/platform/path";
import {
  addSplitPoint,
  buildPageSegmentsFromSplitPoints,
  removeSplitPoint,
  type PageSegment,
} from "./model/pageRange";
import { getPendingPdfFileName, type PdfDocumentMetadata } from "./model/pdfDocument";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./model/splitJob";
import { pdfSplitService } from "./service/pdfSplitService";

type StatusState =
  | { tone: "idle"; message: string; detail?: string }
  | { tone: "running"; activity: "document" | "split"; message: string; detail?: string }
  | { tone: "success"; message: string; detail?: string }
  | { tone: "error"; message: string; detail?: string };

type RangeEntry = {
  fileName: string;
  outputPath: string | null;
  segment: PageSegment;
};

export function PdfSplitPage() {
  const { t } = useI18n();
  const [document, setDocument] = useState<PdfDocumentMetadata | null>(null);
  const [pendingInputPath, setPendingInputPath] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState("");
  const [splitPointInput, setSplitPointInput] = useState("");
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [segments, setSegments] = useState<PageSegment[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [selectedRangeIndex, setSelectedRangeIndex] = useState(0);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: t("statusAwaitingSetup"),
  });
  const inputPath = document?.inputPath ?? "";
  const pageCount = document?.pageCount ?? null;
  const documentName = document?.fileName ?? getPendingPdfFileName(pendingInputPath);
  const displayedInputPath = document?.inputPath ?? pendingInputPath ?? "";
  const isBusy = status.tone === "running";
  const isSplitRunning = status.tone === "running" && status.activity === "split";

  function buildIdleStatus(currentPageCount: number | null): StatusState {
    return {
      tone: "idle",
      message: currentPageCount !== null ? t("statusReadyForRange") : t("statusAwaitingSetup"),
    };
  }

  function describeError(error: unknown) {
    if (typeof error === "string" && error.trim()) {
      return error;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.trim()
    ) {
      return error.message;
    }

    return t("statusUnknownError");
  }

  useEffect(() => {
    if (pageCount === null) {
      setSegments([]);
      setValidationMessage(null);
      setSelectedRangeIndex(0);
      return;
    }

    try {
      const nextSegments = buildPageSegmentsFromSplitPoints(splitPoints, pageCount);
      setSegments(nextSegments);
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
  }, [pageCount, splitPoints, t]);

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
    splitPoints.length > 0 &&
    segments.length > 0 &&
    !validationMessage &&
    !isBusy;

  async function handleChooseInput() {
    const selectedPath = await pdfSplitService.pickPdfFile();
    if (!selectedPath) {
      return;
    }

    const hasExistingDocument = document !== null;
    setPendingInputPath(selectedPath);
    setStatus({
      tone: "running",
      activity: "document",
      message: t(hasExistingDocument ? "statusReplacingDocument" : "statusLoadingDocument"),
    });

    try {
      const metadata = await pdfSplitService.getPdfMetadata(selectedPath);
      setDocument(metadata);
      setPendingInputPath(null);
      setSplitPointInput("");
      setSplitPoints([]);
      setSegments([]);
      setOutputFiles([]);
      setValidationMessage(null);
      setSelectedRangeIndex(0);
      setStatus(buildIdleStatus(metadata.pageCount));
    } catch {
      setPendingInputPath(null);
      setStatus({
        tone: "error",
        message: t(hasExistingDocument ? "statusMetadataReplaceError" : "statusMetadataError"),
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
      activity: "split",
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
        detail: `${response.outputFiles.length} file(s) saved to ${outputDir}`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: t("statusSplitError"),
        detail: describeError(error),
      });
    }
  }

  function handleSplitPointInputChange(value: string) {
    setSplitPointInput(value);
    setOutputFiles([]);

    if (validationMessage) {
      setValidationMessage(null);
    }

    if (status.tone !== "running") {
      setStatus(buildIdleStatus(pageCount));
    }
  }

  function handleAddSplitPoint() {
    if (pageCount === null || isBusy) {
      return;
    }

    try {
      setSplitPoints((current) => addSplitPoint(current, splitPointInput, pageCount));
      setSplitPointInput("");
      setOutputFiles([]);
      setValidationMessage(null);
      setStatus(buildIdleStatus(pageCount));
    } catch (error) {
      const errorKey: MessageKey =
        error instanceof Error ? (error.message as MessageKey) : "statusUnknownError";
      setValidationMessage(t(errorKey));
    }
  }

  function handleRemoveSplitPoint(splitPoint: number) {
    setSplitPoints((current) => removeSplitPoint(current, splitPoint));
    setOutputFiles([]);
    setValidationMessage(null);

    if (status.tone !== "running") {
      setStatus(buildIdleStatus(pageCount));
    }
  }

  function handleSplitPointInputKeyDown(key: string) {
    if (key === "Enter") {
      handleAddSplitPoint();
    }
  }

  return (
    <section
      className="split-stage"
      data-live-state={document ? "loaded" : pendingInputPath ? "loading" : "empty"}
    >
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
          <div className="split-dropzone" data-slot="dropzone" data-empty={!displayedInputPath}>
            <div className="split-dropzoneBadge">PDF</div>
            <h3 className="split-panelTitle">{t("inputFileLabel")}</h3>
            <p className="split-panelCopy">{t("pdfSplitIntakeBody")}</p>

            <div className="split-stageActions">
              <button type="button" className="primary-button" onClick={handleChooseInput} disabled={isBusy}>
                {t("browseFileAction")}
              </button>
            </div>

            <div className="split-dropzoneMeta">
              <span>{t("inputFileLabel")}</span>
              <strong>{documentName || t("summaryPendingValue")}</strong>
            </div>

            {displayedInputPath ? <p className="split-documentPath">{displayedInputPath}</p> : null}
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
                  <button type="button" className="ghost-button" onClick={handleChooseOutput} disabled={isBusy}>
                    {t("browseFolderAction")}
                  </button>
                </div>
              </label>

              <div className="field-block">
                <span className="field-label">{t("pageRangeLabel")}</span>
                <div className="field-row">
                  <input
                    className="field-input"
                    value={splitPointInput}
                    onChange={(event) => handleSplitPointInputChange(event.currentTarget.value)}
                    onKeyDown={(event) => handleSplitPointInputKeyDown(event.key)}
                    placeholder={t("pageRangePlaceholder")}
                    disabled={pageCount === null || isBusy}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleAddSplitPoint}
                    disabled={pageCount === null || isBusy}
                  >
                    {t("splitPointAddAction")}
                  </button>
                </div>

                <div className="split-pointList" data-empty={splitPoints.length === 0}>
                  {splitPoints.length > 0 ? (
                    splitPoints.map((splitPoint) => (
                      <div key={splitPoint} className="split-pointChip">
                        <span>{`${splitPoint}${t("splitPointAfterSuffix")}`}</span>
                        <button
                          type="button"
                          className="ghost-button split-pointRemove"
                          onClick={() => handleRemoveSplitPoint(splitPoint)}
                          disabled={isBusy}
                        >
                          {t("splitPointRemoveAction")}
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="split-emptyCopy">{t("splitPointEmpty")}</p>
                  )}
                </div>
              </div>
            </div>

            {validationMessage ? <div className="validation-banner">{validationMessage}</div> : null}

            <div className="status-card" data-tone={status.tone}>
              <strong>{status.message}</strong>
              {status.detail ? <p className="status-detail">{status.detail}</p> : null}
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
          <section
            className="panel-card split-infoPanel"
            data-slot="document-info"
            data-empty={!displayedInputPath}
          >
            <div className="section-badge">{t("summaryDocumentLabel")}</div>
            <h3 className="split-panelTitle">{t("pdfSplitDocTitle")}</h3>

            {displayedInputPath ? (
              <>
                <strong className="split-documentName">{documentName || getFileName(displayedInputPath)}</strong>
                <p className="split-documentPath">{displayedInputPath}</p>
                <div className="split-metricGrid">
                  <div className="metric-card">
                    <span className="metric-label">{t("summaryPageCountLabel")}</span>
                    <strong>{pageCount ?? t("summaryPendingValue")}</strong>
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
              {isSplitRunning ? t("splitRunningAction") : t("splitSubmitAction")}
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
