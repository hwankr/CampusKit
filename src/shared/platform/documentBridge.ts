import { invoke } from "@tauri-apps/api/core";
import { downloadDir } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import type { SplitRequestPayload } from "../../features/pdf-split/model/splitJob";
import type {
  RenderPdfPagesRequest,
  RenderPdfPagesResponse,
} from "./pdfPreviewContract";
export type {
  PdfPreviewImagePayload,
  PdfPreviewSizePreset,
  RenderPdfPagesRequest,
  RenderPdfPagesResponse,
} from "./pdfPreviewContract";

type PdfMetadataResponse = {
  fileName: string;
  pageCount: number;
};

type SplitPdfResponse = {
  outputFiles: string[];
};

function coerceDialogPath(value: string | string[] | null) {
  return typeof value === "string" ? value : null;
}

export async function pickPdfFile() {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  return coerceDialogPath(selected);
}

export async function getDefaultOutputDirectory() {
  return downloadDir();
}

export async function pickOutputDirectory(defaultPath?: string) {
  const selected = await open({
    multiple: false,
    directory: true,
    defaultPath,
  });

  return coerceDialogPath(selected);
}

export async function getPdfMetadata(inputPath: string) {
  return invoke<PdfMetadataResponse>("get_pdf_metadata", {
    request: { inputPath },
  });
}

export async function splitPdf(request: SplitRequestPayload) {
  return invoke<SplitPdfResponse>("split_pdf", {
    request,
  });
}

export async function renderPdfPages(request: RenderPdfPagesRequest) {
  return invoke<RenderPdfPagesResponse>("render_pdf_pages", {
    request,
  });
}
