function stripJsonComments(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') {
        i++;
      }
      output += '\n';
      continue;
    }

    if (char === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        output += input[i] === '\n' ? '\n' : '';
        i++;
      }
      i++;
      continue;
    }

    output += char;
  }

  return output;
}

function stripTrailingCommas(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ',') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j] ?? '')) {
        j++;
      }
      if (input[j] === '}' || input[j] === ']') {
        continue;
      }
    }

    output += char;
  }

  return output;
}

export function parseJsonc(content: string): unknown {
  const withoutBom = content.replace(/^\uFEFF/, '');
  return JSON.parse(stripTrailingCommas(stripJsonComments(withoutBom)));
}
