import { getFileStem } from "../../../shared/platform/path";
import type { PageSegment } from "./pageRange";

export type SplitSegmentPayload = {
  start: number;
  end: number;
  label: string;
};

export type SplitRequestPayload = {
  inputPath: string;
  outputDir: string;
  baseName: string;
  segments: SplitSegmentPayload[];
};

export function deriveSplitBaseName(inputPath: string) {
  return getFileStem(inputPath) || "split";
}

export function buildPreviewFileName(baseName: string, segment: PageSegment, index: number) {
  const safeBase = baseName.trim() || "split";
  return `${safeBase}-part-${String(index + 1).padStart(2, "0")}-pages-${segment.label}.pdf`;
}

export function toSplitRequestPayload(
  inputPath: string,
  outputDir: string,
  segments: PageSegment[],
): SplitRequestPayload {
  return {
    inputPath,
    outputDir,
    baseName: deriveSplitBaseName(inputPath),
    segments: segments.map(({ start, end, label }) => ({
      start,
      end,
      label,
    })),
  };
}
