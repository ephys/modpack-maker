import { Autolinker } from 'autolinker';
import remarkAutolinkHeading from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypePresetMinify from 'rehype-preset-minify';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const processor = unified()
  .use(remarkParse)
  .use(remarkAutolinkHeading)
  .use(rehypePresetMinify)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeHighlight)
  .use(rehypeStringify, {
    quoteSmart: true,
    preferUnquoted: true,
    omitOptionalTags: true,
    closeSelfClosing: true,
    collapseEmptyAttributes: true,
    entities: { useShortestReferences: true },
  });

export async function parseProjectMarkdown(raw: string): Promise<string> {
  const out = String(await processor.process(raw));

  return Autolinker.link(out);
}
