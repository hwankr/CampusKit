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
      className="split-workspace"
      data-live-state={document ? "loaded" : pendingInputPath ? "loading" : "empty"}
    >
      <div className="split-toolbar">
        <div className="split-toolbarMain">
          <div className="split-toolbarTitleRow">
            <span className="split-toolbarMark">SP</span>
            <h2 className="split-toolbarTitle">{t("pdfSplitTitle")}</h2>
          </div>
          <div className="split-toolbarChips" data-slot="document-info">
            <span className="split-toolbarChip">{documentName || t("summaryPendingValue")}</span>
            <span className="split-toolbarChip">
              {pageCount !== null ? `${pageCount} ${t("summaryPagesUnit")}` : t("summaryPendingValue")}
            </span>
          </div>
        </div>

        <div className="split-toolbarActions">
          <button type="button" className="split-toolbarUtility">
            Share
          </button>
          <button type="button" className="split-toolbarUtility">
            More
          </button>
          <div data-slot="save-action">
            <button
              type="button"
              className="primary-button split-toolbarSave"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {isSplitRunning ? t("splitRunningAction") : t("splitSubmitAction")}
            </button>
          </div>
        </div>
      </div>

      <div className="split-stage">
        <div className="split-rail">
          <section className="split-region split-guidanceRegion">
            <div className="split-regionLabel">{t("pdfSplitSetupTitle")}</div>
            <div className="split-guidanceNote">
              <p className="split-panelCopy">{t("pdfSplitSetupBody")}</p>
              <p className="split-guidanceEmphasis">{t("pdfSplitFlowRange")}</p>
            </div>
          </section>

          <section className="split-region split-intakeRegion" data-slot="dropzone" data-empty={!displayedInputPath}>
            <div className="split-regionLabel">{t("inputFileLabel")}</div>
            <div className="split-intakeWell">
              <div className="split-intakeBadge">PDF</div>
              <p className="split-panelCopy">{t("pdfSplitIntakeBody")}</p>
              <button type="button" className="ghost-button split-intakeButton" onClick={handleChooseInput} disabled={isBusy}>
                {t("browseFileAction")}
              </button>
              <div className="split-intakeMeta">
                <strong>{documentName || t("summaryPendingValue")}</strong>
                <span>{displayedInputPath ? getFileName(displayedInputPath) : t("summaryPendingValue")}</span>
              </div>
              {displayedInputPath ? <p className="split-documentPath">{displayedInputPath}</p> : null}
            </div>
          </section>

          <section
            className="split-region split-rangesRegion"
            data-slot="ranges-panel"
            data-empty={rangeEntries.length === 0}
          >
            <div className="split-regionHeader">
              <div className="split-regionLabel">{t("pdfSplitRangesTitle")}</div>
              <button
                type="button"
                className="split-addAction"
                onClick={handleAddSplitPoint}
                disabled={pageCount === null || isBusy}
              >
                +
              </button>
            </div>

            <div className="split-rangeComposer">
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

            {splitPoints.length > 0 ? (
              <div className="split-pointStrip">
                {splitPoints.map((splitPoint) => (
                  <button
                    key={splitPoint}
                    type="button"
                    className="split-pointToken"
                    onClick={() => handleRemoveSplitPoint(splitPoint)}
                    disabled={isBusy}
                  >
                    <span>{`${splitPoint}${t("splitPointAfterSuffix")}`}</span>
                    <span className="split-pointTokenAction">{t("splitPointRemoveAction")}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {rangeEntries.length > 0 ? (
              <div className="split-rangeList">
                {rangeEntries.map((entry, index) => (
                  <button
                    key={`${entry.segment.label}-${index}`}
                    type="button"
                    className={`split-rangeRow${selectedRangeIndex === index ? " is-selected" : ""}`}
                    onClick={() => setSelectedRangeIndex(index)}
                  >
                    <span className="split-rangeDot" />
                    <span className="split-rangeRowLabel">{entry.segment.label}</span>
                    <span className="split-rangeRowMeta">{entry.fileName}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="split-rangeList">
                <div className="split-rangeRow is-ghost">
                  <span className="split-rangeDot" />
                  <span className="split-rangeRowLabel">Pages 1 - 10</span>
                </div>
                <div className="split-rangeRow is-ghost">
                  <span className="split-rangeDot" />
                  <span className="split-rangeRowLabel">Pages 11 - 20</span>
                </div>
                <div className="split-rangeRow is-ghost">
                  <span className="split-rangeDot" />
                  <span className="split-rangeRowLabel">Custom Range...</span>
                </div>
              </div>
            )}
          </section>

          <section className="split-region split-outputRegion" data-slot="setup-panel">
            <div className="split-regionLabel">{t("outputDirLabel")}</div>
            <div className="split-outputField">
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

            {validationMessage ? <div className="validation-banner">{validationMessage}</div> : null}

            <div className="status-card" data-tone={status.tone}>
              <strong>{status.message}</strong>
              {status.detail ? <p className="status-detail">{status.detail}</p> : null}
            </div>
          </section>
        </div>

        <div className="split-canvasRegion">
          <section className="split-previewField" data-slot="preview-panel" data-empty={!selectedEntry}>
            <div className="split-previewCanvas">
              <article className="split-manuscript">
                <div className="split-manuscriptFolio">Folio 042</div>
                <h3 className="split-manuscriptTitle">
                  {selectedEntry ? selectedEntry.fileName : t("pdfSplitPreviewEmpty")}
                </h3>
                <div className="split-manuscriptBody">
                  <p>
                    {selectedEntry
                      ? `${selectedEntry.segment.label} / ${selectedEntry.segment.pageCount} ${t("summaryPagesUnit")}`
                      : t("pdfSplitPreviewHintEmpty")}
                  </p>
                  <p>{displayedInputPath || t("pdfSplitIntakeBody")}</p>
                  <div className="split-manuscriptQuote">
                    {selectedEntry ? selectedEntry.segment.label : t("pdfSplitPreviewCaption")}
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className="split-thumbnailShelf" data-slot="thumbnail-rail" data-empty={rangeEntries.length === 0}>
            {rangeEntries.length > 0 ? (
              <div className="split-thumbnailList">
                {rangeEntries.map((entry, index) => (
                  <button
                    key={`${entry.segment.label}-thumb`}
                    type="button"
                    className={`split-thumbnailCard${selectedRangeIndex === index ? " is-selected" : ""}`}
                    onClick={() => setSelectedRangeIndex(index)}
                  >
                    <div className="split-thumbnailFrame">
                      {index === 0 ? entry.fileName.slice(0, 8) : null}
                    </div>
                    <div className="split-thumbnailNumber">{String(index + 1)}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="split-thumbnailList">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={`placeholder-${index + 1}`}
                    className={`split-thumbnailCard${index === 0 ? " is-selected" : ""}`}
                  >
                    <div className="split-thumbnailFrame">{index === 0 ? documentName || "Page" : null}</div>
                    <div className="split-thumbnailNumber">{String(index + 1)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
