import functools
import http.server
import json
import threading
import webbrowser
from pathlib import Path
from ai.npc import Observation, decide

PORT = 8765
ROOT = Path(__file__).resolve().parent


class GameHandler(http.server.SimpleHTTPRequestHandler):
    """Serve the UI and its local, stateless NPC policy."""

    def do_POST(self):
        if self.path != "/api/npc":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 32768:
                raise ValueError("Invalid request size")
            request = json.loads(self.rfile.read(length))
            observations = request["observations"]
            if not isinstance(observations, list) or not 1 <= len(observations) <= 3:
                raise ValueError("Invalid NPC batch")
            result = [decide(Observation(**view), request["action"]) for view in observations]
            status, body = 200, {"provider": "python", "decisions": result}
        except (ValueError, TypeError, KeyError, AttributeError):
            status, body = 400, {"error": "Invalid NPC observation"}
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main(open_browser: bool = True) -> None:
    handler = functools.partial(GameHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/ui/index.html"
        print(f"GREED! 실행 중: {url} (종료: Ctrl+C)")
        if open_browser:
            threading.Timer(0.5, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")


if __name__ == "__main__":
    main()
