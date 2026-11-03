/** Conservative server-side rich-text sanitizer. Never keeps HTML attributes or non-text media. */
const TAGS = new Set(['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote']);
const ESCAPE = (text: string) => text.replace(/&(?!(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z\d]{1,30});)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tokenize tags and escape all other text; disallow every attribute, script and embedded file. */
export function sanitizeFormato3Html(raw: string): string {
  if (typeof raw !== 'string') throw new Error('Contenido inválido.');
  if (raw.length > 200_000 || Buffer.byteLength(raw, 'utf8') > 200_000) throw new Error('El documento supera los 200 KB.');
  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<[^>]*>/g;
  let result = '';
  let cursor = 0;
  for (const match of raw.matchAll(tokens)) {
    const i = match.index ?? 0;
    result += ESCAPE(raw.slice(cursor, i));
    const tag = /^<\s*(\/?)\s*([a-z][a-z\d]*)\b[^>]*>$/i.exec(match[0]);
    if (tag && TAGS.has(tag[2].toLowerCase())) {
      const name = tag[2].toLowerCase();
      result += name === 'br' ? '<br>' : `<${tag[1] ? '/' : ''}${name}>`;
    }
    cursor = i + match[0].length;
  }
  result += ESCAPE(raw.slice(cursor));
  if (Buffer.byteLength(result, 'utf8') > 200_000) throw new Error('El documento supera los 200 KB.');
  return result;
}
