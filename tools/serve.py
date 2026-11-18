"""개발용 정적 서버: 캐시를 끈다(수정한 스테이지 파일이 새로고침만으로 바로 반영되게).
사용: python tools/serve.py [포트=8080]"""
import http.server, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()
