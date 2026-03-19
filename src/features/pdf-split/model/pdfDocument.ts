import { getFileName } from "../../../shared/platform/path.ts";

export type PdfDocumentMetadata = {
  inputPath: string;
  fileName: string;
  pageCount: number;
};

export type PdfMetadataPayload = {
  fileName: string;
  pageCount: number;
};

export function buildPdfDocumentMetadata(
  inputPath: string,
  metadata: PdfMetadataPayload,
): PdfDocumentMetadata {
  const fallbackFileName = getFileName(inputPath) || "document.pdf";

  return {
    inputPath,
    fileName: metadata.fileName.trim() || fallbackFileName,
    pageCount: metadata.pageCount,
  };
}

export function getPendingPdfFileName(inputPath: string | null) {
  return inputPath ? getFileName(inputPath) : "";
}
