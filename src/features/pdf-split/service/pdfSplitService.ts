import {
  getPdfMetadata as loadPdfMetadata,
  pickOutputDirectory,
  pickPdfFile,
  renderPdfPages as loadRenderedPdfPages,
  splitPdf,
} from "../../../shared/platform/documentBridge";
import type {
  PdfPreviewImagePayload,
  RenderPdfPagesRequest,
  RenderPdfPagesResponse,
} from "../../../shared/platform/documentBridge";
import { buildPdfDocumentMetadata } from "../model/pdfDocument";

export type { PdfPreviewImagePayload, RenderPdfPagesRequest, RenderPdfPagesResponse };

export const pdfSplitService = {
  async getPdfMetadata(inputPath: string) {
    const metadata = await loadPdfMetadata(inputPath);
    return buildPdfDocumentMetadata(inputPath, metadata);
  },
  pickOutputDirectory,
  pickPdfFile,
  renderPdfPages(request: RenderPdfPagesRequest) {
    return loadRenderedPdfPages(request);
  },
  splitPdf,
};
