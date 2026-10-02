import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('./fixtures/repository-exhibit/', import.meta.url);
export const exhibitSources = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8')).map(source => ({
  ...source, text: readFileSync(new URL(source.file, root), 'utf8'),
}));
export function exhibitDocumentFixture(repoName, ref, kind = 'source') {
  const source = exhibitSources.find(item => item.repoName === repoName);
  let text = source?.text || '## Getting started\nUse the instructions supplied by this fixture repository.\n```sh\nfixture-command --public\n```\n';
  if (kind === 'missing') text = '# Sample\n## Overview\nNo installation instructions or preview have been supplied.\n';
  if (kind === 'ko') text = '# 예제\n## 실행 준비\n이 예제는 테스트 환경에서만 실행합니다.\n```sh\nprintf \"한국어 원문\\n\"\n```\n';
  if (kind === 'hostile') text = '# Example\n## Getting started\nWindows only. Read all conditions first.\n\n'
    + '<img src="https://tracking.invalid/pixel" onerror="window.EXHIBIT_PWNED=1"><script>window.EXHIBIT_PWNED=2</script>\n\n'
    + '[unsafe](javascript:alert(1)) [data](data:text/html,test) [docs](docs/start.md) ![pixel](https://tracking.invalid/pixel.svg)\n\n'
    + '```sh\nprintf \'<script>literal source, never execute</script>\'\n' + 'long-argument-'.repeat(100) + '\n```\n';
  const bytes = Buffer.from(text);
  return { type: 'file', name: 'README.md', path: 'README.md', encoding: 'base64', size: bytes.length,
    content: bytes.toString('base64'), sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    html_url: `https://github.com/${repoName}/blob/${ref}/README.md` };
}
