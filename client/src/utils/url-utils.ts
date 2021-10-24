export function uriTag(strings: TemplateStringsArray, ...parameters: any[]) {
  let out = '';
  let i = 0;

  for (const string of strings) {
    out += string;
    if (parameters[i] != null && parameters[i] !== '') {
      out += encodeURIComponent(String(parameters[i]));
      i++;
    }
  }

  return out;
}
