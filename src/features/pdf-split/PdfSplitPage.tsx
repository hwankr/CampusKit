import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../../shared/i18n/messages/ko";
import { useI18n } from "../../shared/i18n/useI18n";
import { getFileName } from "../../shared/platform/path";
import { getPendingPdfFileName, type PdfDocumentMetadata } from "./model/pdfDocument";
import {
  buildExecutablePageSegments,
  buildPageRangePlanSignature,
  buildRangeInputRewriteForDerivedFinalSegment,
  buildRangeInputRewriteForTypedSegment,
  canDismissDerivedFinalSegment,
  parsePageRangeInput,
  type PageSegment,
  type RangeInputRewrite,
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
  isDerivedFinal: boolean;
  provenance: "typed" | "derived-final";
  segment: PageSegment;
  typedIndex: number | null;
};

function toPreviewDataUri(payload: PdfPreviewImagePayload | null) {
  return payload ? `data:${payload.mimeType};base64,${payload.base64}` : null;
}

export function PdfSplitPage() {
  const { t } = useI18n();
  const [document, setDocument] = useState<PdfDocumentMetadata | null>(null);
  const [pendingInputPath, setPendingInputPath] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState("");
  const [rangeInput, setRangeInput] = useState("");
  const [typedSegments, setTypedSegments] = useState<PageSegment[]>([]);
  const [derivedFinalSegment, setDerivedFinalSegment] = useState<PageSegment | null>(null);
  const [dismissedTailSignature, setDismissedTailSignature] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [selectedPageNumber, setSelectedPageNumber] = useState(1);
  const rangeInputRef = useRef<HTMLTextAreaElement | null>(null);
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
      setTypedSegments([]);
      setDerivedFinalSegment(null);
      setValidationMessage(null);
      setSelectedPageNumber(syncSelectedPageNumber(null, 1, true));
      return;
    }

    if (!rangeInput.trim()) {
      setTypedSegments([]);
      setDerivedFinalSegment(null);
      setValidationMessage(null);
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
      return;
    }

    try {
      const plan = parsePageRangeInput(rangeInput, pageCount);

      setTypedSegments(plan.typedSegments);
      setDerivedFinalSegment(plan.derivedFinalSegment);
      setValidationMessage(null);
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
    } catch (error) {
      const errorKey: MessageKey =
        error instanceof Error ? (error.message as MessageKey) : "statusUnknownError";

      setTypedSegments([]);
      setDerivedFinalSegment(null);
      setValidationMessage(t(errorKey));
      setSelectedPageNumber((currentPageNumber) =>
        syncSelectedPageNumber(pageCount, currentPageNumber),
      );
    }
  }, [pageCount, rangeInput, t]);

  useEffect(() => {
    if (outputDir) {
      return;
    }

    let isActive = true;

    void pdfSplitService
      .getDefaultOutputDirectory()
      .then((defaultOutputDir) => {
        if (isActive && defaultOutputDir) {
          setOutputDir(defaultOutputDir);
        }
      })
      .catch(() => {
        // Fallback to the current manual flow when Downloads cannot be resolved.
      });

    return () => {
      isActive = false;
    };
  }, [outputDir]);

  const typedPlanSignature =
    pageCount !== null ? buildPageRangePlanSignature(typedSegments, pageCount) : null;
  const isDerivedFinalDismissed =
    derivedFinalSegment !== null &&
    typedPlanSignature !== null &&
    dismissedTailSignature === typedPlanSignature;
  const activeSegments = buildExecutablePageSegments(
    typedSegments,
    derivedFinalSegment,
    !isDerivedFinalDismissed,
  );
  const expectedFiles = activeSegments.map((segment, index) =>
    buildPreviewFileName(deriveSplitBaseName(documentName || inputPath), segment, index),
  );
  const rangeEntries: RangeEntry[] = activeSegments.map((segment, index) => ({
    segment,
    fileName: outputFiles[index] ? getFileName(outputFiles[index]) : expectedFiles[index],
    isDerivedFinal:
      derivedFinalSegment !== null && !isDerivedFinalDismissed && index === activeSegments.length - 1,
    provenance:
      derivedFinalSegment !== null && !isDerivedFinalDismissed && index === activeSegments.length - 1
        ? "derived-final"
        : "typed",
    typedIndex:
      derivedFinalSegment !== null && !isDerivedFinalDismissed && index === activeSegments.length - 1
        ? null
        : index,
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
  const selectedSegment = findPageSegmentForPage(activeSegments, selectedPageNumber);
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
  const composerFeedbackMessage = validationMessage ?? t("rangePlanComposerHint");
  const canDismissDerivedFinalEntry = canDismissDerivedFinalSegment(typedSegments);
  const planSummary =
    pageCount !== null && rangeEntries.length > 0
      ? `${rangeEntries.length} ${t("splitPlanOutputsUnit")} · ${pageCount} ${t("summaryPagesUnit")}`
      : null;

  const canSubmit =
    Boolean(inputPath) &&
    Boolean(outputDir) &&
    pageCount !== null &&
    Boolean(rangeInput.trim()) &&
    activeSegments.length >= 2 &&
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
      setDismissedTailSignature(null);
      setRangeInput("");
      setDerivedFinalSegment(null);
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
    const selectedPath = await pdfSplitService.pickOutputDirectory(outputDir || undefined);
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
        toSplitRequestPayload(inputPath, outputDir, activeSegments),
      );
      setOutputFiles(response.outputFiles);
      setStatus({
        tone: "success",
        message: t("statusSplitSuccess"),
        detail: `${response.outputFiles.length} ${t("statusSplitSavedCountLabel")} · ${outputDir}`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: t("statusSplitError"),
        detail: describeError(error),
      });
    }
  }

  function handleRangeInputChange(value: string) {
    setRangeInput(value);
    setOutputFiles([]);

    if (validationMessage) {
      setValidationMessage(null);
    }

    if (status.tone !== "running") {
      setStatus(buildIdleStatus(pageCount));
    }
  }

  function focusRangeInput(rewrite: RangeInputRewrite) {
    const applyFocus = () => {
      const textarea = rangeInputRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      const selectionStart = Math.min(rewrite.selectionStart, textarea.value.length);
      const selectionEnd = Math.min(Math.max(selectionStart, rewrite.selectionEnd), textarea.value.length);
      textarea.setSelectionRange(selectionStart, selectionEnd);
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(applyFocus);
      return;
    }

    setTimeout(applyFocus, 0);
  }

  function applyRangeInputRewrite(rewrite: RangeInputRewrite) {
    handleRangeInputChange(rewrite.value);
    focusRangeInput(rewrite);
  }

  function handleSelectRangeEntry(entry: RangeEntry) {
    setSelectedPageNumber(entry.segment.start);
  }

  function handleEditRangeEntry(entry: RangeEntry) {
    if (entry.provenance === "derived-final") {
      if (!derivedFinalSegment) {
        return;
      }

      applyRangeInputRewrite(
        buildRangeInputRewriteForDerivedFinalSegment(typedSegments, derivedFinalSegment),
      );
      return;
    }

    if (entry.typedIndex === null) {
      return;
    }

    applyRangeInputRewrite(buildRangeInputRewriteForTypedSegment(typedSegments, entry.typedIndex));
  }

  function handleDismissDerivedFinalEntry() {
    if (!derivedFinalSegment || !typedPlanSignature || !canDismissDerivedFinalEntry) {
      return;
    }

    setDismissedTailSignature(typedPlanSignature);
    setOutputFiles([]);

    if (status.tone !== "running") {
      setStatus(buildIdleStatus(pageCount));
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
              {pageCount !== null
                ? `${pageCount} ${t("summaryPagesUnit")}`
                : t("summaryPendingValue")}
            </span>
          </div>
        </div>

        <div className="split-toolbarActions">
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
          <section
            className="split-region split-intakeRegion"
            data-slot="dropzone"
            data-empty={!displayedInputPath}
          >
            <div className="split-regionLabel">{t("inputFileLabel")}</div>
            <div className="split-intakeWell">
              <div className="split-intakeBadge">PDF</div>
              <button
                type="button"
                className="ghost-button split-intakeButton"
                onClick={handleChooseInput}
                disabled={isBusy}
              >
                {t("browseFileAction")}
              </button>
              <div className="split-intakeMeta">
                <strong>{documentName || t("summaryPendingValue")}</strong>
                <span>
                  {displayedInputPath ? getFileName(displayedInputPath) : t("summaryPendingValue")}
                </span>
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
              {planSummary ? <div className="split-planSummary">{planSummary}</div> : null}
            </div>

            <textarea
              ref={rangeInputRef}
              className="field-textarea split-rangeTextarea"
              value={rangeInput}
              onChange={(event) => handleRangeInputChange(event.currentTarget.value)}
              placeholder={t("pageRangePlaceholder")}
              aria-describedby="split-range-composer-feedback"
              aria-invalid={validationMessage ? "true" : "false"}
              disabled={pageCount === null || isBusy}
              rows={3}
            />

            <div
              id="split-range-composer-feedback"
              className={`split-rangeComposerFeedback${validationMessage ? " is-error" : ""}`}
            >
              {composerFeedbackMessage}
            </div>

            {rangeEntries.length > 0 ? (
              <div className="split-rangeList">
                {rangeEntries.map((entry, index) => (
                  <div
                    key={`${entry.segment.label}-${index}`}
                    className={`split-rangeRow${
                      isPageInSegment(entry.segment, selectedPageNumber) ? " is-selected" : ""
                    }`}
                  >
                    <span className="split-rangeDot" />
                    <div className="split-rangeContent">
                      <button
                        type="button"
                        className="split-rangeButton"
                        data-slot="range-row-action"
                        onClick={() => handleSelectRangeEntry(entry)}
                        aria-pressed={isPageInSegment(entry.segment, selectedPageNumber)}
                      >
                        <span className="split-rangeButtonHeader">
                          <span className="split-rangeRowLabel">{entry.segment.label}</span>
                          <span className="split-rangeRowCount">
                            {`${entry.segment.pageCount} ${t("summaryPagesUnit")}`}
                          </span>
                          {entry.isDerivedFinal ? (
                            <span className="split-rangeBadge">{t("splitRangeDerivedBadge")}</span>
                          ) : null}
                        </span>
                        <span className="split-rangeRowMeta">{entry.fileName}</span>
                      </button>
                      <div className="split-rangeActions">
                        <button
                          type="button"
                          className="split-rangeEditAction"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEditRangeEntry(entry);
                          }}
                        >
                          {t("splitRangeEditAction")}
                        </button>
                        {entry.provenance === "derived-final" ? (
                          <button
                            type="button"
                            className="split-rangeRemoveAction"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDismissDerivedFinalEntry();
                            }}
                            aria-label={t("splitRangeDismissAction")}
                            title={t("splitRangeDismissAction")}
                            disabled={!canDismissDerivedFinalEntry}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="split-rangeEmpty">{t("pdfSplitRangesEmpty")}</div>
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
              <button
                type="button"
                className="ghost-button"
                onClick={handleChooseOutput}
                disabled={isBusy}
              >
                {t("browseFolderAction")}
              </button>
            </div>

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
                  {`${t("pdfSplitPreviewFolioLabel")} ${String(selectedPageNumber).padStart(3, "0")}`}
                </div>
                <div className="split-manuscriptImageFrame" data-loading={selectedPreviewLoading}>
                  {selectedPreviewDataUri ? (
                    <img
                      className="split-manuscriptImage"
                      src={selectedPreviewDataUri}
                      alt={`${t("pdfSplitPreviewAlt")} ${selectedPageNumber}`}
                    />
                  ) : (
                    <div className="split-manuscriptPlaceholder">
                      <strong>
                        {pageCount !== null
                          ? `${t("pdfSplitPreviewPageLabel")} ${selectedPageNumber}`
                          : t("pdfSplitPreviewEmpty")}
                      </strong>
                      <span>
                        {selectedPreviewLoading
                          ? t("statusLoadingDocument")
                          : t("pdfSplitPreviewHintEmpty")}
                      </span>
                    </div>
                  )}
                </div>
                <h3 className="split-manuscriptTitle">
                  {pageCount !== null
                    ? `${documentName || t("pdfSplitPreviewEmpty")} · ${t("pdfSplitPreviewPageLabel")} ${selectedPageNumber}`
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
                      : validationMessage ?? displayedInputPath ?? t("rangePlanComposerHint")}
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
                  const thumbnailImage = thumbnailCacheKey
                    ? previewCache[thumbnailCacheKey] ?? null
                    : null;
                  const thumbnailLoading = thumbnailCacheKey
                    ? previewLoadingKeySet.has(thumbnailCacheKey)
                    : false;
                  const thumbnailDataUri = toPreviewDataUri(thumbnailImage);

                  return (
                    <button
                      key={pageItem.key}
                      type="button"
                      className={`split-thumbnailCard${
                        selectedPageNumber === pageItem.pageNumber ? " is-selected" : ""
                      }`}
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
                            alt={`${t("pdfSplitThumbnailAlt")} ${pageItem.pageNumber}`}
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
                    <div className="split-thumbnailFrame">
                      {index === 0 ? documentName || t("pdfSplitPreviewPageLabel") : null}
                    </div>
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
