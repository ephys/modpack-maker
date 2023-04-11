//
// Based on https://github.com/limulus/jarfile/blob/master/src/Jar.js
// But fixed
//
export function parseJarManifest(manifest: string | Buffer) {
  const result = { main: {}, sections: {} };

  let expectingSectionStart = false;
  let skip = 0;
  let currentSection: string | null = null;

  manifest = manifest.toString('utf8');
  const wrappedLines = manifest.split(/(?:\r\n|\r|\n)/);
  const lines: string[] = [];

  // Lines in MANIFEST.MF can be split. A line starting with a space
  //  means that it is the continuation of the previous line.
  //
  // This loop turns
  //
  // Name: data/appliedenergistics2/recipes/network/crafting/patterns_blank
  //  .json
  //
  // into
  //
  // Name: data/appliedenergistics2/recipes/network/crafting/patterns_blank.json
  for (const line of wrappedLines) {
    if (line.startsWith(' ')) {
      lines[lines.length - 1] += line;
    } else {
      lines.push(line);
    }
  }

  for (let [i, line] of lines.entries()) {
    let entry: { [key: string]: string };
    // this line may have already been processed, if so skip it
    if (skip) {
      skip--;

      continue;
    }

    // Watch for blank lines, they mean we're starting a new section
    if (line === '') {
      expectingSectionStart = true;

      continue;
    }

    // Extract the name and value from entry line
    const pair = line.match(/^([a-z0-9_-]+): (.*)$/i);
    if (!pair) {
      throwManifestParseError('expected a valid entry', i, line);
    }

    const name = pair[1];
    const val = (pair[2] || '');

    // Handle section start
    if (expectingSectionStart && name !== 'Name') {
      throwManifestParseError('expected section name', i, line);
    } else if (expectingSectionStart) {
      currentSection = val;
      expectingSectionStart = false;

      continue;
    }

    // Add entry to the appropriate section
    if (currentSection) {
      if (!result.sections[currentSection]) {
        result.sections[currentSection] = {};
      }

      entry = result.sections[currentSection];
    } else {
      entry = result.main;
    }

    entry[name] = val;
    for (let j = i + 1; j < lines.length; j++) {
      const byteLen = Buffer.byteLength(line, 'utf8');
      if (byteLen >= 70) {
        line = lines[j];
        if (line && line.startsWith(' ')) {
          // continuation lines must start with a space
          entry[name] += line.slice(1);
          skip++;
          continue;
        }
      }

      break;
    }
  }

  return result;
}

function throwManifestParseError(msg, lineNum, lineContent): never {
  throw new Error(`Failed to parse manifest at line ${lineNum}: ${msg}\n\n${lineContent}`);
}
