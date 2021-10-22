export function mavenVersionRangeToSemver(mavenRange: string): string {
  if (!mavenRange) {
    throw new Error(`Invalid Maven Range received: ${mavenRange}`);
  }

  return VersionRange.fromMaven(mavenRange).toNpmSemver();
}

export class VersionRange {
  #sets: VersionRangeSet[] = [];

  static fromMaven(rangeStr: string): VersionRange {
    const ranges = splitMavenRange(rangeStr);

    const obj = new VersionRange();

    for (const range of ranges) {
      obj.#sets.push(VersionRangeSet.fromMaven(range));
    }

    return obj;
  }

  toNpmSemver(): string {
    return this.#sets.map(set => set.toNpmSemver()).join(' || ');
  }
}

export function splitMavenRange(range: string): string[] {
  range = range.trim();

  let i = 0;

  const parts: string[] = [];

  const maxIterations = 10;
  let iterations = 0;

  while (i < range.length) {
    // bounded range : [a,b)
    if (range.charAt(i) === '[' || range.charAt(i) === '(') {
      let rangeEndIndex = anyIndexOf(range, '])', i);
      if (rangeEndIndex === -1) {
        rangeEndIndex = range.length;
      }

      // +1 because we include the final ] or )
      parts.push(range.substring(i, rangeEndIndex + 1));
      // +2 to skip to after the comma that follows ] or )
      i = rangeEndIndex + 2;
    } else {
      // single version: a
      let nextCommaIndex = range.indexOf(',', i);
      if (nextCommaIndex === -1) {
        nextCommaIndex = range.length;
      }

      parts.push(range.substring(i, nextCommaIndex));
      // +1 to skip to after the
      i = nextCommaIndex + 1;
    }

    if (iterations++ >= maxIterations) {
      throw new Error('Too many iterations');
    }
  }

  return parts;
}

export class VersionRangeSet {
  start: string;
  end: string;

  startInclusive;
  endInclusive;

  static fromMaven(range: string): VersionRangeSet {
    range = range.trim();

    const set = new VersionRangeSet();

    const isRange = range.startsWith('[') || range.startsWith('(');
    if (!isRange) {
      // TODO: ensure start/end is a-zA-Z0-9 . - _ only
      set.start = range;
      set.end = range;
      set.startInclusive = true;
      set.endInclusive = true;
    } else {
      set.startInclusive = range.startsWith('[');
      set.endInclusive = range.endsWith(']');

      if (range.startsWith('[') || range.startsWith('(')) {
        range = range.substr(1);
      }

      if (range.endsWith(']') || range.endsWith(')')) {
        range = range.substr(0, range.length - 1);
      }

      const parts = range.split(',');

      set.start = parts[0];
      set.end = set.endInclusive ? (parts[1] || parts[0]) : parts[1];
    }

    Object.freeze(set);

    return set;
  }

  toNpmSemver(): string {
    if (this.start === this.end && this.startInclusive && this.endInclusive) {
      return this.start;
    }

    const start = this.start ? `${this.startInclusive ? '>=' : '>'}${this.start}` : '';
    const end = this.end ? `${this.endInclusive ? '<=' : '<'}${this.end}` : '';

    return `${start} ${end}`.trim();
  }
}

function anyIndexOf(string: string, needlesStr: string, start: number) {
  const needles = needlesStr.split('');
  let i = -1;
  for (const needle of needles) {
    const pos = string.indexOf(needle, start);
    if (pos === -1) {
      continue;
    }

    if (i === -1) {
      i = pos;
    }

    if (pos < i) {
      i = pos;
    }
  }

  return i;
}
