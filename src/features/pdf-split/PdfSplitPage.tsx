import { useEffect, useState } from "react";
import { useI18n } from "../../shared/i18n/useI18n";
import type { MessageKey } from "../../shared/i18n/messages/ko";
import { getFileName } from "../../shared/platform/path";
import { SplitForm } from "./components/SplitForm";
import { SplitSummaryPanel } from "./components/SplitSummaryPanel";
import { pdfSplitClient } from "./api/pdfSplitClient";
import { parsePageRangeInput, type PageSegment } from "./model/pageRange";
import { buildPreviewFileName, deriveSplitBaseName, toSplitRequestPayload } from "./model/splitJob";

type StatusState =
  | { tone: "idle"; message: string }
  | { tone: "running"; message: string }
  | { tone: "success"; message: string }
  | { tone: "error"; message: string };

export function PdfSplitPage() {
  const { t } = useI18n();
  const [inputPath, setInputPath] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [pageRangeText, setPageRangeText] = useState("");
  const [segments, setSegments] = useState<PageSegment[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: t("statusAwaitingSetup"),
  });

  useEffect(() => {
    if (!pageRangeText.trim() || pageCount === null) {
      setSegments([]);
      if (!pageRangeText.trim()) {
        setValidationMessage(null);
      }
      return;
    }

    try {
      const nextSegments = parsePageRangeInput(pageRangeText, pageCount);
      setSegments(nextSegments);
      setValidationMessage(null);
    } catch (error) {
      const errorKey: MessageKey =
        error instanceof Error ? (error.message as MessageKey) : "statusUnknownError";
      setSegments([]);
      setValidationMessage(t(errorKey));
    }
  }, [pageCount, pageRangeText, t]);

  const previewFiles = segments.map((segment, index) =>
    buildPreviewFileName(deriveSplitBaseName(inputPath), segment, index),
  );

  const canSubmit =
    Boolean(inputPath) &&
    Boolean(outputDir) &&
    pageCount !== null &&
    segments.length > 0 &&
    !validationMessage &&
    status.tone !== "running";

  async function handleChooseInput() {
    const selectedPath = await pdfSplitClient.pickPdfFile();
    if (!selectedPath) {
      return;
    }

    try {
      const metadata = await pdfSplitClient.getPdfMetadata(selectedPath);
      setInputPath(selectedPath);
      setDocumentName(metadata.fileName);
      setPageCount(metadata.pageCount);
      setStatus({
        tone: "idle",
        message: t("statusReadyForRange"),
      });
    } catch {
      setStatus({
        tone: "error",
        message: t("statusMetadataError"),
      });
    }
  }

  async function handleChooseOutput() {
    const selectedPath = await pdfSplitClient.pickOutputDirectory();
    if (!selectedPath) {
      return;
    }

    setOutputDir(selectedPath);
    setStatus({
      tone: "idle",
      message: pageCount !== null ? t("statusReadyForRange") : t("statusAwaitingSetup"),
    });
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
      await pdfSplitClient.splitPdf(toSplitRequestPayload(inputPath, outputDir, segments));

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

  return (
    <section className="split-layout">
      <SplitForm
        inputPath={inputPath}
        outputDir={outputDir}
        pageRangeText={pageRangeText}
        validationMessage={validationMessage}
        canSubmit={canSubmit}
        isRunning={status.tone === "running"}
        onInputBrowse={handleChooseInput}
        onOutputBrowse={handleChooseOutput}
        onRangeChange={setPageRangeText}
        onSubmit={handleSubmit}
      />

      <SplitSummaryPanel
        documentName={documentName || getFileName(inputPath)}
        pageCount={pageCount}
        previewFiles={previewFiles}
        segments={segments}
        statusTone={status.tone}
        statusMessage={status.message}
      />
    </section>
  );
}
