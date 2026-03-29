export type PageSegment = {
  start: number;
  end: number;
  label: string;
  pageCount: number;
};

export type ParsedPageRangePlan = {
  derivedFinalSegment: PageSegment | null;
  segments: PageSegment[];
  typedSegments: PageSegment[];
};

export function parsePageRangeInput(value: string, totalPages: number): ParsedPageRangePlan {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("validationOutOfBounds");
  }

  const normalizedInput = value.trim();

  if (!normalizedInput) {
    throw new Error("validationEmptyRange");
  }

  const typedSegments = normalizedInput
    .split(/[\n,]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => parsePageRangeToken(token));

  if (typedSegments.length === 0) {
    throw new Error("validationEmptyRange");
  }

  let previousEnd = 0;

  typedSegments.forEach((segment, index) => {
    if (index === 0 && segment.start !== 1) {
      throw new Error("validationRangeMustStartAtOne");
    }

    if (segment.start <= previousEnd) {
      throw new Error("validationOverlappingRange");
    }

    if (segment.start > previousEnd + 1 && index > 0) {
      throw new Error("validationRangeGapNotAllowed");
    }

    if (segment.end > totalPages) {
      throw new Error("validationOutOfBounds");
    }

    previousEnd = segment.end;
  });

  const derivedFinalSegment =
    previousEnd < totalPages ? buildPageSegment(previousEnd + 1, totalPages) : null;
  const segments = derivedFinalSegment ? [...typedSegments, derivedFinalSegment] : typedSegments;

  if (segments.length < 2) {
    throw new Error("validationRangeRequiresAtLeastTwoOutputs");
  }

  return {
    derivedFinalSegment,
    segments,
    typedSegments,
  };
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
    label: start === end ? `${start}` : `${start}-${end}`,
    pageCount: end - start + 1,
  };
}
