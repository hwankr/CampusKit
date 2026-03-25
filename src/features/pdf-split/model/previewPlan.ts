import type {
  PdfPreviewSizePreset,
  RenderPdfPagesRequest,
} from "../../../shared/platform/pdfPreviewContract.ts";
import type { PageSegment } from "./pageRange.ts";

export const INITIAL_THUMBNAIL_WINDOW_SIZE = 8;

export type PdfPageItem = {
  key: string;
  pageNumber: number;
};

export type PlannedPreviewRequest = RenderPdfPagesRequest & {
  cacheKeys: string[];
};

function clampPageNumber(pageNumber: number, pageCount: number) {
  const normalized = Number.isFinite(pageNumber) ? Math.trunc(pageNumber) : 1;
  return Math.min(Math.max(normalized, 1), pageCount);
}

export function clampSelectedPageNumber(selectedPageNumber: number, pageCount: number | null) {
  if (pageCount === null || pageCount < 1) {
    return 1;
  }

  return clampPageNumber(selectedPageNumber, pageCount);
}

export function syncSelectedPageNumber(
  pageCount: number | null,
  currentSelectedPageNumber: number,
  shouldReset = false,
) {
  if (shouldReset) {
    return 1;
  }

  return clampSelectedPageNumber(currentSelectedPageNumber, pageCount);
}

export function buildPdfPageItems(pageCount: number) {
  if (pageCount < 1) {
    return [];
  }

  return Array.from({ length: pageCount }, (_, index) => ({
    key: `page-${index + 1}`,
    pageNumber: index + 1,
  })) satisfies PdfPageItem[];
}

export function buildPreviewCacheKey(
  inputPath: string,
  sizePreset: PdfPreviewSizePreset,
  pageNumber: number,
) {
  return `${inputPath}::${sizePreset}::${pageNumber}`;
}

export function buildThumbnailWindowPageNumbers(
  selectedPageNumber: number,
  pageCount: number,
  windowSize = INITIAL_THUMBNAIL_WINDOW_SIZE,
) {
  if (pageCount < 1 || windowSize < 1) {
    return [];
  }

  const safeWindowSize = Math.min(Math.trunc(windowSize), pageCount);
  const focusPage = clampPageNumber(selectedPageNumber, pageCount);
  const halfWindow = Math.floor(safeWindowSize / 2);
  let start = Math.max(1, focusPage - halfWindow);
  let end = start + safeWindowSize - 1;

  if (end > pageCount) {
    end = pageCount;
    start = Math.max(1, end - safeWindowSize + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function buildPlannedPreviewRequests(
  inputPath: string,
  pageCount: number,
  selectedPageNumber: number,
  windowSize = INITIAL_THUMBNAIL_WINDOW_SIZE,
) {
  if (!inputPath || pageCount < 1) {
    return [];
  }

  const focusPage = clampPageNumber(selectedPageNumber, pageCount);
  const thumbnailPageNumbers = buildThumbnailWindowPageNumbers(
    focusPage,
    pageCount,
    windowSize,
  );

  // Keep the focused page first so the eventual renderer can prioritize it.
  return [
    {
      inputPath,
      pageNumbers: [focusPage],
      sizePreset: "focus",
      cacheKeys: [buildPreviewCacheKey(inputPath, "focus", focusPage)],
    },
    {
      inputPath,
      pageNumbers: thumbnailPageNumbers,
      sizePreset: "thumbnail",
      cacheKeys: thumbnailPageNumbers.map((pageNumber) =>
        buildPreviewCacheKey(inputPath, "thumbnail", pageNumber),
      ),
    },
  ] satisfies PlannedPreviewRequest[];
}

export function buildPreviewCacheKeys(requests: PlannedPreviewRequest[]) {
  return requests.flatMap((request) => request.cacheKeys);
}

export function getMissingPreviewPageNumbers(
  inputPath: string,
  sizePreset: PdfPreviewSizePreset,
  pageNumbers: number[],
  previewCache: Record<string, unknown>,
  previewLoadingKeys: string[],
) {
  return pageNumbers.filter((pageNumber) => {
    const cacheKey = buildPreviewCacheKey(inputPath, sizePreset, pageNumber);

    return previewCache[cacheKey] === undefined && !previewLoadingKeys.includes(cacheKey);
  });
}

export function isPageInSegment(segment: PageSegment, pageNumber: number) {
  return pageNumber >= segment.start && pageNumber <= segment.end;
}

export function findPageSegmentForPage(segments: PageSegment[], pageNumber: number) {
  return segments.find((segment) => isPageInSegment(segment, pageNumber)) ?? null;
}
