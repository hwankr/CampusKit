import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../../shared/i18n/messages/ko";
import { useI18n } from "../../shared/i18n/useI18n";
import { getFileName } from "../../shared/platform/path";
import { getPendingPdfFileName, type PdfDocumentMetadata } from "./model/pdfDocument";
import {
  addSplitPoint,
  buildPageSegmentsFromSplitPoints,
  removeSplitPoint,
  type PageSegment,
} from "./model/pageRange";
import {
  buildPdfPageItems,
  buildPlannedPreviewRequests,
  buildPreviewCacheKey,
  findPageSegmentForPage,
  getMissingPreviewPageNumbers,
  isPageInSegment,
  syncSelectedPageNumber,
} from "./model/previewPlan";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./model/splitJob";
import {
  pdfSplitService,
  type PdfPreviewImagePayload,
  type RenderPdfPagesRequest,
} from "./service/pdfSplitService";

type StatusState =
  | { tone: "idle"; message: string; detail?: string }
  | { tone: "running"; activity: "document" | "split"; message: string; detail?: string }
  | { tone: "success"; message: string; detail?: string }
  | { tone: "error"; message: string; detail?: string };

type RangeEntry = {
  fileName: string;
  segment: PageSegment;
};

function toPreviewDataUri(payload: PdfPreviewImagePayload | null) {
  return payload ? `data:${payload.mimeType};base64,${payload.base64}` : null;
}

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
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const [previewCache, setPreviewCache] = useState<Record<string, PdfPreviewImagePayload>>({});
  const [previewLoadingKeys, setPreviewLoadingKeys] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewCacheRef = useRef<Record<string, PdfPreviewImagePayload>>({});
  const previewLoadingKeysRef = useRef<string[]>([]);
  const previewSessionRef = useRef(0);
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
      setSelectedPageNumber(syncSelectedPageNumber(null, 1, true));
      return;
    }

    if (splitPoints.length === 0) {
      setSegments([]);
      setValidationMessage(null);
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
      return;
    }

    try {
      const nextSegments = buildPageSegmentsFromSplitPoints(splitPoints, pageCount);
      setSegments(nextSegments);
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
    } catch (error) {
      const errorKey: MessageKey =
        error instanceof Error ? (error.message as MessageKey) : "statusUnknownError";
      setSegments([]);
      setValidationMessage(t(errorKey));
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
    }
  }, [pageCount, splitPoints, t]);

  const expectedFiles = segments.map((segment, index) =>
    buildPreviewFileName(deriveSplitBaseName(documentName || inputPath), segment, index),
  );

const rangeEntries: RangeEntry[] = segments.map((segment, index) => ({
  segment,
  fileName: outputFiles[index] ? getFileName(outputFiles[index]) : expectedFiles[index],
}));

  const pageItems = pageCount !== null ? buildPdfPageItems(pageCount) : [];
  const previewRequestPlan =
    pageCount !== null && inputPath
      ? buildPlannedPreviewRequests(inputPath, pageCount, selectedPageNumber)
      : [];
  const thumbnailRequest = previewRequestPlan.find((request) => request.sizePreset === "thumbnail") ?? null;
  const thumbnailWindowPages = new Set(thumbnailRequest?.pageNumbers ?? []);
  const previewRequestOrder = previewRequestPlan.map((request) => request.sizePreset).join(",");
  const previewLoadingKeySet = new Set(previewLoadingKeys);
  const selectedSegment = findPageSegmentForPage(segments, selectedPageNumber);
  const focusPreviewCacheKey =
    inputPath && pageCount !== null
      ? buildPreviewCacheKey(inputPath, "focus", selectedPageNumber)
      : null;
  const thumbnailPreviewCacheKey =
    inputPath && pageCount !== null
      ? buildPreviewCacheKey(inputPath, "thumbnail", selectedPageNumber)
      : null;
  const selectedPreviewImage =
    (focusPreviewCacheKey ? previewCache[focusPreviewCacheKey] : null) ??
    (thumbnailPreviewCacheKey ? previewCache[thumbnailPreviewCacheKey] : null) ??
    null;
  const selectedPreviewLoading =
    (focusPreviewCacheKey ? previewLoadingKeySet.has(focusPreviewCacheKey) : false) ||
    (thumbnailPreviewCacheKey ? previewLoadingKeySet.has(thumbnailPreviewCacheKey) : false);
  const selectedPreviewDataUri = toPreviewDataUri(selectedPreviewImage);

  const canSubmit =
    Boolean(inputPath) &&
    Boolean(outputDir) &&
    pageCount !== null &&
    splitPoints.length > 0 &&
    segments.length > 0 &&
    !validationMessage &&
    !isBusy;

  function resetPreviewState() {
    previewSessionRef.current += 1;
    previewCacheRef.current = {};
    previewLoadingKeysRef.current = [];
    setPreviewCache({});
    setPreviewLoadingKeys([]);
    setPreviewError(null);
  }

  function addPreviewLoadingKeys(keys: string[]) {
    previewLoadingKeysRef.current = Array.from(
      new Set([...previewLoadingKeysRef.current, ...keys]),
    );
    setPreviewLoadingKeys(previewLoadingKeysRef.current);
  }

  function removePreviewLoadingKeys(keys: string[]) {
    previewLoadingKeysRef.current = previewLoadingKeysRef.current.filter(
      (cacheKey) => !keys.includes(cacheKey),
    );
    setPreviewLoadingKeys(previewLoadingKeysRef.current);
  }

  useEffect(() => {
    if (!inputPath || pageCount === null || previewRequestPlan.length === 0) {
      return;
    }
    const previewSession = previewSessionRef.current;

    async function loadPreviewBatch(request: RenderPdfPagesRequest) {
      const missingPageNumbers = getMissingPreviewPageNumbers(
        inputPath,
        request.sizePreset,
        request.pageNumbers,
        previewCacheRef.current,
        previewLoadingKeysRef.current,
      );

      if (missingPageNumbers.length === 0) {
        return;
      }

      const loadingKeys = missingPageNumbers.map((pageNumber: number) =>
        buildPreviewCacheKey(inputPath, request.sizePreset, pageNumber),
      );

      addPreviewLoadingKeys(loadingKeys);

      try {
        const response = await pdfSplitService.renderPdfPages({
          ...request,
          pageNumbers: missingPageNumbers,
        });

        if (previewSession !== previewSessionRef.current) {
          return;
        }

        setPreviewCache((current) => {
          const nextCache = { ...current };

          for (const [pageNumberKey, payload] of Object.entries(
            response,
          ) as [string, PdfPreviewImagePayload][]) {
            const pageNumber = Number(pageNumberKey);

            nextCache[buildPreviewCacheKey(inputPath, request.sizePreset, pageNumber)] = payload;
          }

          previewCacheRef.current = nextCache;
          return nextCache;
        });
      } catch (error) {
        if (previewSession === previewSessionRef.current) {
          setPreviewError(describeError(error));
        }
      } finally {
        removePreviewLoadingKeys(loadingKeys);
      }
    }

    async function loadPreviews() {
      setPreviewError(null);

      for (const request of previewRequestPlan) {
        await loadPreviewBatch(request);
      }
    }

    void loadPreviews();
  }, [inputPath, pageCount, previewRequestPlan, selectedPageNumber]);

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
      resetPreviewState();
      setValidationMessage(null);
      setSelectedPageNumber(syncSelectedPageNumber(metadata.pageCount, 1, true));
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
                  <div
                    key={`${entry.segment.label}-${index}`}
                    className={`split-rangeRow${isPageInSegment(entry.segment, selectedPageNumber) ? " is-selected" : ""}`}
                  >
                    <span className="split-rangeDot" />
                    <span className="split-rangeRowLabel">{entry.segment.label}</span>
                    <span className="split-rangeRowMeta">{entry.fileName}</span>
                  </div>
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
          <section
            className="split-previewField"
            data-slot="preview-panel"
            data-empty={pageCount === null}
            data-preview-request-order={previewRequestOrder || undefined}
          >
            <div className="split-previewCanvas">
              <article className="split-manuscript">
                <div className="split-manuscriptFolio">
                  {`Folio ${String(selectedPageNumber).padStart(3, "0")}`}
                </div>
                <div
                  className="split-manuscriptImageFrame"
                  data-loading={selectedPreviewLoading}
                >
                  {selectedPreviewDataUri ? (
                    <img
                      className="split-manuscriptImage"
                      src={selectedPreviewDataUri}
                      alt={`Preview of page ${selectedPageNumber}`}
                    />
                  ) : (
                    <div className="split-manuscriptPlaceholder">
                      <strong>{pageCount !== null ? `Page ${selectedPageNumber}` : t("pdfSplitPreviewEmpty")}</strong>
                      <span>
                        {selectedPreviewLoading ? t("statusLoadingDocument") : t("pdfSplitPreviewHintEmpty")}
                      </span>
                    </div>
                  )}
                </div>
                <h3 className="split-manuscriptTitle">
                  {pageCount !== null
                    ? `${documentName || t("pdfSplitPreviewEmpty")} · Page ${selectedPageNumber}`
                    : t("pdfSplitPreviewEmpty")}
                </h3>
                <div className="split-manuscriptBody">
                  <p>
                    {pageCount !== null
                      ? `${selectedPageNumber} / ${pageCount} ${t("summaryPagesUnit")}`
                      : t("pdfSplitPreviewHintEmpty")}
                  </p>
                  <p>
                    {selectedSegment
                      ? `${selectedSegment.label} / ${selectedSegment.pageCount} ${t("summaryPagesUnit")}`
                      : displayedInputPath || t("statusReadyForRange")}
                  </p>
                  <div className="split-manuscriptQuote">
                    {selectedSegment ? selectedSegment.label : t("pdfSplitPreviewCaption")}
                  </div>
                  {previewError ? <div className="validation-banner">{previewError}</div> : null}
                </div>
              </article>
            </div>
          </section>

          <section
            className="split-thumbnailShelf"
            data-slot="thumbnail-rail"
            data-empty={pageItems.length === 0}
          >
            {pageItems.length > 0 ? (
              <div className="split-thumbnailList">
                {pageItems.map((pageItem) => {
                  const thumbnailCacheKey =
                    inputPath && pageCount !== null
                      ? buildPreviewCacheKey(inputPath, "thumbnail", pageItem.pageNumber)
                      : null;
                  const thumbnailImage = thumbnailCacheKey ? previewCache[thumbnailCacheKey] ?? null : null;
                  const thumbnailLoading = thumbnailCacheKey
                    ? previewLoadingKeySet.has(thumbnailCacheKey)
                    : false;
                  const thumbnailDataUri = toPreviewDataUri(thumbnailImage);

                  return (
                    <button
                      key={pageItem.key}
                      type="button"
                      className={`split-thumbnailCard${selectedPageNumber === pageItem.pageNumber ? " is-selected" : ""}`}
                      onClick={() => setSelectedPageNumber(pageItem.pageNumber)}
                      data-windowed={thumbnailWindowPages.has(pageItem.pageNumber)}
                    >
                      <div
                        className="split-thumbnailFrame"
                        data-loading={thumbnailLoading}
                        data-windowed={thumbnailWindowPages.has(pageItem.pageNumber)}
                      >
                        {thumbnailDataUri ? (
                          <img
                            className="split-thumbnailImage"
                            src={thumbnailDataUri}
                            alt={`Thumbnail of page ${pageItem.pageNumber}`}
                          />
                        ) : (
                          <span className="split-thumbnailState">
                            {thumbnailWindowPages.has(pageItem.pageNumber)
                              ? String(pageItem.pageNumber).padStart(2, "0")
                              : ""}
                          </span>
                        )}
                      </div>
                      <div className="split-thumbnailNumber">{String(pageItem.pageNumber)}</div>
                    </button>
                  );
                })}
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
