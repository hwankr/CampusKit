export const pdfPreviewSizePresets = ["thumbnail", "focus"] as const;

export type PdfPreviewSizePreset = (typeof pdfPreviewSizePresets)[number];

export type PdfPreviewImagePayload = {
  mimeType: string;
  base64: string;
  width: number;
  height: number;
};

export type RenderPdfPagesRequest = {
  inputPath: string;
  pageNumbers: number[];
  sizePreset: PdfPreviewSizePreset;
};

export type RenderPdfPagesResponse = Record<string, PdfPreviewImagePayload>;
