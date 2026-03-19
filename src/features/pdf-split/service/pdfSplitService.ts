import {
  getPdfMetadata as loadPdfMetadata,
  pickOutputDirectory,
  pickPdfFile,
  splitPdf,
} from "../../../shared/platform/documentBridge";
import { buildPdfDocumentMetadata } from "../model/pdfDocument";

export const pdfSplitService = {
  async getPdfMetadata(inputPath: string) {
    const metadata = await loadPdfMetadata(inputPath);
    return buildPdfDocumentMetadata(inputPath, metadata);
  },
  pickOutputDirectory,
  pickPdfFile,
  splitPdf,
};
