export type PageSegment = {
  start: number;
  end: number;
  label: string;
  pageCount: number;
};

export function parsePageRangeInput(value: string, totalPages: number): PageSegment[] {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error("validationEmptyRange");
  }

  const segments = tokens.map(parseSegmentToken);
  const seenPages = new Set<number>();

  for (const segment of segments) {
    if (segment.start < 1 || segment.end < 1) {
      throw new Error("validationPageIndex");
    }

    if (segment.start > segment.end) {
      throw new Error("validationDescendingRange");
    }

    if (segment.end > totalPages) {
      throw new Error("validationOutOfBounds");
    }

    for (let page = segment.start; page <= segment.end; page += 1) {
      if (seenPages.has(page)) {
        throw new Error("validationOverlappingRange");
      }

      seenPages.add(page);
    }
  }

  return segments.map((segment) => ({
    ...segment,
    pageCount: segment.end - segment.start + 1,
  }));
}

function parseSegmentToken(token: string): Omit<PageSegment, "pageCount"> {
  if (/^\d+$/.test(token)) {
    const page = Number(token);
    return { start: page, end: page, label: `${page}` };
  }

  const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    throw new Error("validationMalformedRange");
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  return {
    start,
    end,
    label: `${start}-${end}`,
  };
}
