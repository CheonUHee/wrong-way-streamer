"""개발용 정적 서버: 캐시를 끈다(수정한 스테이지 파일이 새로고침만으로 바로 반영되게).
소품 편집기(테스트 모드)의 '파일에 저장'도 받는다: POST /__decor → js/stages/<id>.js 의 구역 decor 배열을 고쳐 쓴다.
스트리머 이미지 변환기(tools/sprites.html)의 저장도 받는다: POST /__sprite?name=normal1 → assets/sprites/normal1.webp
사용: python tools/serve.py [포트=8080]"""
import http.server, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def top_level_items(src, start):
    """src[start]가 '['일 때, 짝이 맞는 ']'의 위치와 최상위 원소 목록을 돌려준다.
    원소마다 {'body': 본문, 'com': 같은 줄 끝 주석, 'lead': [바로 위 줄 주석들]}. 문자열·주석 안의 괄호는 무시한다."""
    depth, i, n, items, cur, lead, last_end = 0, start, len(src), [], '', [], None
    def finish(end):
        nonlocal cur, lead, last_end
        if cur.strip():
            items.append({'body': cur.strip(), 'com': '', 'lead': lead}); lead = []; last_end = end
        cur = ''
    while i < n:
        c = src[i]
        if c in '\'"`':                                 # 문자열
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            cur += src[i:j + 1]; i = j + 1; continue
        if src.startswith('//', i):                     # 줄 주석
            j = src.find('\n', i); j = n if j < 0 else j
            com = src[i:j].rstrip()
            if depth > 1: cur += com
            elif cur.strip():                            # 쉼표 없는 마지막 원소 뒤 주석
                gap = cur[len(cur.rstrip()):]; finish(i); items[-1]['com'] = com; items[-1]['gap'] = gap
            elif items and last_end is not None and '\n' not in src[last_end:i]:
                items[-1]['com'] = com; items[-1]['gap'] = src[last_end:i]   # 쉼표와 주석 사이 공백(줄 맞춤)을 그대로 둔다
            else: lead.append(com)                       # 혼자 있는 줄 주석: 다음 원소의 머리 주석
            i = j; continue
        if c in '[{(':
            depth += 1
            if depth == 1: i += 1; continue
        elif c in ']})':
            depth -= 1
            if depth == 0:
                finish(i); return i, items
        elif c == ',' and depth == 1:
            finish(i + 1); i += 1; continue
        cur += c; i += 1
    raise ValueError('decor 배열의 닫는 괄호를 찾지 못했습니다')

def save_decor(stage, area, entries):
    if not re.fullmatch(r'[A-Za-z0-9_-]+', stage) or not re.fullmatch(r'[A-Za-z0-9_]+', area):
        raise ValueError('잘못된 이름')
    path = os.path.join(ROOT, 'js', 'stages', stage + '.js')
    src = open(path, encoding='utf-8').read()
    m = re.search(r'^\s*' + area + r': \{', src, re.M)
    if not m: raise ValueError(f'구역 {area}를 찾지 못했습니다')
    d = re.compile(r'\bdecor: \[').search(src, m.end())
    nxt = re.compile(r'^    [A-Za-z0-9_]+: \{', re.M).search(src, m.end())   # 다음 구역 전에 있어야 한다
    if not d or (nxt and d.start() > nxt.start()): raise ValueError(f'구역 {area}에 decor 배열이 없습니다. 먼저 decor: [] 를 만들어 주세요')
    open_i = d.end() - 1
    close_i, old = top_level_items(src, open_i)
    line_start = src.rfind('\n', 0, d.start()) + 1
    indent = src[line_start:d.start()]
    inner = indent + '  '
    out = []
    for e in entries:
        o = e.get('orig')
        prev = old[o] if o is not None and 0 <= o < len(old) else None
        if prev: out += [inner + c for c in prev['lead']]
        body = prev['body'] if prev and e.get('line') is None else e['line']
        out.append(f'{inner}{body},' + (prev.get('gap', '   ') + prev['com'] if prev and prev['com'] else ''))
    new = src[:open_i + 1] + ('\n' + '\n'.join(out) + '\n' + indent if out else '') + src[close_i:]
    open(path, 'w', encoding='utf-8', newline='').write(new)
    return f'js/stages/{stage}.js · {area} · 소품 {len(entries)}개'

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_POST(self):
        if self.path.startswith('/__sprite?name='):
            return self.save_sprite(self.path.split('=', 1)[1])
        if self.path != '/__decor':
            return self.send_error(404)
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            msg, code = save_decor(body['stage'], body['area'], body['items']), 200
        except Exception as e:
            msg, code = str(e), 400
        data = msg.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers(); self.wfile.write(data)

    # 스트리머 이미지 변환기(tools/sprites.html)가 만든 웹용 이미지를 assets/sprites/<이름>.webp 로 저장
    def save_sprite(self, name):
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if not re.fullmatch(r'[a-z]+\d*', name) or not data.startswith(b'RIFF'):
            return self.send_error(400, 'bad sprite')
        os.makedirs('assets/sprites', exist_ok=True)
        with open(f'assets/sprites/{name}.webp', 'wb') as f:
            f.write(data)
        self.send_response(200); self.send_header('Content-Length', '0'); self.end_headers()

os.chdir(ROOT)
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
