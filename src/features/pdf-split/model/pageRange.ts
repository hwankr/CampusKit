export type PageSegment = {
  start: number;
  end: number;
  label: string;
  pageCount: number;
};

export type ParsedPageRangePlan = {
  segments: PageSegment[];
};

export type RangeInputRewrite = {
  selectionEnd: number;
  selectionStart: number;
  value: string;
};

export function parsePageRangeInput(value: string, totalPages: number): ParsedPageRangePlan {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("validationOutOfBounds");
  }

  const normalizedInput = value.trim();

  if (!normalizedInput) {
    throw new Error("validationEmptyRange");
  }

  const segments = normalizedInput
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => parsePageRangeToken(token));

  if (segments.length === 0) {
    throw new Error("validationEmptyRange");
  }

  let previousEnd = 0;

  segments.forEach((segment) => {
    if (segment.start <= previousEnd) {
      throw new Error("validationOverlappingRange");
    }

    if (segment.end > totalPages) {
      throw new Error("validationOutOfBounds");
    }

    previousEnd = segment.end;
  });

  return {
    segments,
  };
}

export function serializePageRangeInput(segments: PageSegment[]): string {
  return segments.map((segment) => formatPageRangeToken(segment)).join(", ");
}

export function buildRangeInputRewriteForTypedSegment(
  typedSegments: PageSegment[],
  typedIndex: number,
): RangeInputRewrite {
  if (!typedSegments[typedIndex]) {
    throw new Error("validationMalformedRange");
  }

  return buildRangeInputRewrite(typedSegments, typedIndex);
}

export function parseSplitPointInput(value: string): number {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("validationEmptySplitPoint");
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error("validationMalformedSplitPoint");
  }

  const splitPoint = Number(normalized);

  if (splitPoint < 1) {
    throw new Error("validationPageIndex");
  }

  return splitPoint;
}

export function addSplitPoint(splitPoints: number[], value: string, totalPages: number): number[] {
  const nextPoint = parseSplitPointInput(value);
  validateSplitPoint(nextPoint, totalPages);

  if (splitPoints.includes(nextPoint)) {
    throw new Error("validationDuplicateSplitPoint");
  }

  return [...splitPoints, nextPoint].sort((left, right) => left - right);
}

export function removeSplitPoint(splitPoints: number[], value: number): number[] {
  return splitPoints.filter((splitPoint) => splitPoint !== value);
}

export function buildPageSegmentsFromSplitPoints(
  splitPoints: number[],
  totalPages: number,
): PageSegment[] {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("validationOutOfBounds");
  }

  const sortedPoints = [...splitPoints].sort((left, right) => left - right);
  sortedPoints.forEach((splitPoint) => validateSplitPoint(splitPoint, totalPages));

  const segments: PageSegment[] = [];
  let rangeStart = 1;

  for (let index = 0; index < sortedPoints.length; index += 1) {
    const splitPoint = sortedPoints[index];

    if (index > 0 && splitPoint === sortedPoints[index - 1]) {
      throw new Error("validationDuplicateSplitPoint");
    }

    segments.push(buildPageSegment(rangeStart, splitPoint));
    rangeStart = splitPoint + 1;
  }

  segments.push(buildPageSegment(rangeStart, totalPages));

  return segments;
}

function validateSplitPoint(splitPoint: number, totalPages: number) {
  if (splitPoint < 1) {
    throw new Error("validationPageIndex");
  }

  if (splitPoint >= totalPages) {
    throw new Error("validationSplitPointOutOfBounds");
  }
}

function parsePageRangeToken(token: string): PageSegment {
  if (/^\d+$/.test(token)) {
    const pageNumber = Number(token);

    if (pageNumber < 1) {
      throw new Error("validationPageIndex");
    }

    return buildPageSegment(pageNumber, pageNumber);
  }

  const match = token.match(/^(\d+)\s*-\s*(\d+)$/);

  if (!match) {
    throw new Error("validationMalformedRange");
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (start < 1 || end < 1) {
    throw new Error("validationPageIndex");
  }

  if (start > end) {
    throw new Error("validationDescendingRange");
  }

  return buildPageSegment(start, end);
}

function buildPageSegment(start: number, end: number): PageSegment {
  return {
    start,
    end,
    label: formatPageRangeToken({ start, end }),
    pageCount: end - start + 1,
  };
}

function buildRangeInputRewrite(
  segments: PageSegment[],
  targetIndex: number,
): RangeInputRewrite {
  const tokens = segments.map((segment) => formatPageRangeToken(segment));
  const value = tokens.join(", ");
  let selectionStart = 0;

  for (let index = 0; index < targetIndex; index += 1) {
    selectionStart += tokens[index].length + 2;
  }

  return {
    value,
    selectionStart,
    selectionEnd: selectionStart + tokens[targetIndex].length,
  };
}

function formatPageRangeToken(segment: Pick<PageSegment, "start" | "end">) {
  return segment.start === segment.end ? `${segment.start}` : `${segment.start}-${segment.end}`;
}
