from pathlib import Path
from html.parser import HTMLParser
from html import unescape
import urllib.request, json, re, hashlib, os

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'evidence'
OUT.mkdir(exist_ok=True)
ADDRESS = '0xFbEF8941Da53EA724385B44E91ae9672061D0263'

class Pres(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = None
        self.items = {}
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'pre':
            self.active = attrs.get('id', 'pre-' + str(len(self.items)))
            self.items[self.active] = ''
    def handle_endtag(self, tag):
        if tag == 'pre': self.active = None
    def handle_data(self, data):
        if self.active is not None: self.items[self.active] += data

result = {}
for chain, host in [('ethereum', 'etherscan.io'), ('fraxtal', 'fraxscan.com')]:
    url = f'https://{host}/address/{ADDRESS}#code'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html'})
        raw = urllib.request.urlopen(req, timeout=45).read()
        (OUT / f'{chain}_explorer_v1.html').write_bytes(raw)
        html = raw.decode()
        p = Pres(); p.feed(html)
        sources = {}
        names = re.findall(r'File\s+\d+\s+of\s+\d+\s*:\s*([^<]+)', html)
        editors = [(key, val) for key, val in p.items.items() if key.startswith('editor')]
        for i, (key, content) in enumerate(editors):
            name = unescape(names[i]).strip() if i < len(names) else key + '.sol'
            sources[name] = {'content': content, 'sha256': hashlib.sha256(content.encode()).hexdigest()}
        abi = None
        for val in p.items.values():
            try:
                candidate = json.loads(val)
                if isinstance(candidate, list) and candidate and all(isinstance(a, dict) and 'type' in a for a in candidate):
                    abi = candidate; break
            except Exception: pass
        result[chain] = {'url': url, 'htmlSha256': hashlib.sha256(raw).hexdigest(), 'sources': sources, 'abi': abi,
                         'preIds': list(p.items), 'fileLabels': names}
        print(chain, 'sources', len(sources), 'abi', len(abi or []), 'files', list(sources))
    except Exception as e:
        result[chain] = {'url': url, 'errorType': type(e).__name__, 'error': str(e)}
        print(chain, 'explorer request failed', type(e).__name__)
(OUT / 'verified_explorer_sources_v1.json').write_text(json.dumps(result, indent=2))
