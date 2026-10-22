export function findSourceExcerpt(source, quote) {
  if (typeof quote !== 'string' || !quote.trim()) return null;
  const tokenize = text => [...text.matchAll(/[\p{L}\p{N}]+(?:\+\+|#)?/gu)].map(match => ({ value: match[0].normalize('NFKC').toLowerCase(), start: match.index, end: match.index + match[0].length }));
  const content = tokenize(source), words = tokenize(quote);
  if (!words.length || words.length > content.length) return null;
  for (let start = 0; start <= content.length - words.length; start++) {
    if (words.every((word, index) => word.value === content[start + index].value)) {
      let end = content[start + words.length - 1].end;
      const punctuation = quote.match(/[)\].,:;!?]+$/)?.[0];
      if (punctuation && source.slice(end).startsWith(punctuation)) end += punctuation.length;
      return source.slice(content[start].start, end);
    }
  }
  return null;
}
