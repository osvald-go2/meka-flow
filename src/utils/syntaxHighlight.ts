const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'import', 'export', 'from', 'class', 'interface', 'type', 'public', 'private',
  'protected', 'await', 'async', 'true', 'false', 'null', 'undefined',
  'npm', 'run', 'deploy',
]);

// Single-pass regex: strings | block comments | line comments | numbers | words
// Order matters — first match wins, preventing cascading replacement issues.
const TOKEN_RE = /("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|`(?:\\`|[^`])*`)|(\/\*[\s\S]*?\*\/)|(\/\/.*|#.*)|\b(\d+)\b|\b(\w+)\b/g;

export function highlight(code: string, language: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Plain text — no syntax highlighting needed
  if (language === 'text' || language === 'plaintext') {
    return escaped;
  }

  return escaped.replace(TOKEN_RE, (match, str, blockComment, lineComment, num, word) => {
    if (str) return `<span class="text-emerald-400">${match}</span>`;
    if (blockComment) return `<span class="text-gray-500/70 italic">${match}</span>`;
    if (lineComment) return `<span class="text-gray-500/70 italic">${match}</span>`;
    if (num) return `<span class="text-orange-400">${match}</span>`;
    if (word && KEYWORDS.has(word)) return `<span class="text-blue-400">${match}</span>`;
    return match;
  });
}
