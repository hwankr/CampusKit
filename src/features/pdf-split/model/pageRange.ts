export type PageSegment = {
  start: number;
  end: number;
  label: string;
  pageCount: number;
};

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

function buildPageSegment(start: number, end: number): PageSegment {
  return {
    start,
    end,
    label: start === end ? `${start}` : `${start}-${end}`,
    pageCount: end - start + 1,
  };
}
