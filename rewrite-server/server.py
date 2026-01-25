from http.server import BaseHTTPRequestHandler, HTTPServer
import json


class RewriteHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        # Allow extension/content script requests without CORS issues.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_POST(self):
        if self.path != "/api/rewrite":
            self._set_headers(404)
            self.wfile.write(b'{"error":"Not found"}')
            return

        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length) if content_length else b"{}"
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(b'{"error":"Invalid JSON"}')
            return

        text = body.get("text", "")
        type_ = body.get("type", "community")
        tone = body.get("tone", "neutral")
        language = body.get("language", "auto")

        result = f"✨ REWRITTEN ({type_}/{tone}/{language})\n\n{text}"
        self._set_headers(200)
        self.wfile.write(json.dumps({"result": result}).encode("utf-8"))


def run():
    server = HTTPServer(("localhost", 8080), RewriteHandler)
    print("Rewrite server running on http://localhost:8080")
    server.serve_forever()


if __name__ == "__main__":
    run()
