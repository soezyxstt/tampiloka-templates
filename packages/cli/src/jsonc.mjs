/** Parse JSON with comments and trailing commas without changing quoted values.
 * The generator has no runtime dependencies; configuration is never evaluated.
 */
export function parseJsonc(source) {
  let stripped = '', quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (quoted) {
      stripped += char;
      if (char === '\\') stripped += source[++i] ?? '';
      else if (char === '"') quoted = false;
    } else if (char === '"') {
      quoted = true; stripped += char;
    } else if (char === '/' && next === '/') {
      stripped += '  '; i++;
      while (i + 1 < source.length && !'\r\n'.includes(source[i + 1])) { i++; stripped += ' '; }
    } else if (char === '/' && next === '*') {
      stripped += '  '; i++;
      let closed = false;
      while (++i < source.length) {
        if (source[i] === '*' && source[i + 1] === '/') { stripped += '  '; i++; closed = true; break; }
        stripped += '\r\n'.includes(source[i]) ? source[i] : ' ';
      }
      if (!closed) throw new SyntaxError('Unterminated JSONC comment');
    } else stripped += char;
  }
  let clean = ''; quoted = false;
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (quoted) {
      clean += char;
      if (char === '\\') clean += stripped[++i] ?? '';
      else if (char === '"') quoted = false;
    } else if (char === '"') { quoted = true; clean += char; }
    else if (char === ',') {
      let j = i + 1;
      while (j < stripped.length && /\s/.test(stripped[j])) j++;
      clean += stripped[j] === '}' || stripped[j] === ']' ? ' ' : char;
    } else clean += char;
  }
  return JSON.parse(clean.replace(/^\uFEFF/, ''));
}
