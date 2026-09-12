#!/usr/bin/env python3
"""HVEN Cloud — gudang data POS di laptop/PC. Python 3, tanpa paket tambahan."""
from __future__ import annotations

import json
import os
import socket
import sys
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

PORT = int(os.environ.get("HVEN_CLOUD_PORT", "8787"))
VERCEL = os.environ.get("HVEN_POS_UI", "https://hven-space-pos-bagas321ty-1278.vercel.app").rstrip("/")
TOKEN = "aacdfc2728ad029ce31fe891ec1b03bb3a3278006507652adc60ea699da549ed"
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
SNAP = DATA / "snapshot.json"
PHOTOS = DATA / "photos"
NAME = os.environ.get("HVEN_CLOUD_NAME") or socket.gethostname() or "hven-cloud"

LIST_KEYS = (
    "products", "orders", "expenses", "incomes", "incidents", "inventory",
    "staff", "attendance", "notifications", "audit", "adjustLogs", "bukuUsers",
    "managerCash", "workShifts", "shiftLogs", "ledger",
)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def lan_ips() -> list[str]:
    found: list[str] = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        found.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in found:
                found.append(ip)
    except OSError:
        pass
    return [ip for ip in found if not ip.startswith("127.")]


def load_doc() -> dict | None:
    if not SNAP.exists():
        return None
    try:
        return json.loads(SNAP.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


_lock = threading.Lock()


def save_doc(doc: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = SNAP.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(SNAP)


def union_id(incoming: list, stored: list) -> list:
    m: dict[str, dict] = {}
    for row in stored or []:
        if isinstance(row, dict) and isinstance(row.get("id"), str):
            m[row["id"]] = row
    for row in incoming or []:
        if isinstance(row, dict) and isinstance(row.get("id"), str):
            m[row["id"]] = row
    return list(m.values())


def merge_payload(incoming: dict, stored: dict | None) -> dict:
    if not stored:
        return incoming
    out = dict(stored)
    out.update({k: v for k, v in incoming.items() if not isinstance(v, list)})
    for key in LIST_KEYS:
        if key in incoming or key in stored:
            out[key] = union_id(incoming.get(key) or [], stored.get(key) or [])
    cats = []
    for c in (stored.get("menuCategories") or []) + (incoming.get("menuCategories") or []):
        if isinstance(c, str) and c.strip() and c not in cats:
            cats.append(c)
    if cats:
        out["menuCategories"] = cats
    return out


def photo_path(pid: str) -> Path:
    safe = "".join(ch for ch in pid if ch.isalnum() or ch in "._-")[:80]
    return PHOTOS / f"{safe}.txt"


class Handler(BaseHTTPRequestHandler):
    server_version = "HVENCloud/1"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (NAME, fmt % args))

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "*")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type, accept")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Vary", "Origin")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("/hven-cloud", "/hven-cloud/", "/health"):
            return self._status()
        if path == "/api/pos-cloud":
            self.send_response(405)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"Gunakan POST."}')
            return
        self._proxy()

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path != "/api/pos-cloud":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length > 20_000_000:
            return self._json(400, {"ok": False, "error": "Paket terlalu besar."})
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._json(400, {"ok": False, "error": "JSON tidak valid."})
        token = body.get("token") if isinstance(body, dict) else ""
        if token != TOKEN:
            return self._json(200, {"ok": False, "error": "Akses sinkron ditolak."})
        op = body.get("op")
        if op == "pull":
            return self._pull()
        if op == "push":
            return self._push(body)
        if op == "photo-get":
            return self._photo_get(str(body.get("id") or ""))
        if op == "photo-put":
            return self._photo_put(str(body.get("id") or ""), str(body.get("data") or ""))
        return self._json(400, {"ok": False, "error": "Operasi tidak dikenal."})

    def _json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _pull(self) -> None:
        with _lock:
            doc = load_doc()
        if not doc:
            return self._json(200, {"ok": True, "empty": True})
        return self._json(200, {
            "ok": True,
            "empty": False,
            "rev": int(doc.get("rev") or 0),
            "updatedAt": doc.get("updatedAt") or now_iso(),
            "payload": doc.get("payload"),
        })

    def _push(self, body: dict) -> None:
        payload = body.get("payload")
        if not isinstance(payload, dict) or not isinstance(payload.get("products"), list):
            return self._json(200, {"ok": False, "error": "Paket data tidak valid."})
        with _lock:
            current = load_doc()
            stored = current.get("payload") if current else None
            merged = merge_payload(payload, stored if isinstance(stored, dict) else None)
            next_doc = {
                "rev": int((current or {}).get("rev") or 0) + 1,
                "updatedAt": now_iso(),
                "device": str(body.get("device") or NAME),
                "payload": merged,
            }
            save_doc(next_doc)
        return self._json(200, {
            "ok": True,
            "rev": next_doc["rev"],
            "updatedAt": next_doc["updatedAt"],
            "payload": merged,
        })

    def _photo_get(self, pid: str) -> None:
        p = photo_path(pid)
        if not p.exists():
            return self._json(200, {"ok": True, "empty": True})
        try:
            data = p.read_text(encoding="utf-8")
        except OSError:
            return self._json(200, {"ok": False, "error": "Gagal ambil foto."})
        return self._json(200, {"ok": True, "data": data})

    def _photo_put(self, pid: str, data: str) -> None:
        if not pid or not data.startswith("data:image/"):
            return self._json(200, {"ok": False, "error": "Foto tidak valid."})
        PHOTOS.mkdir(parents=True, exist_ok=True)
        try:
            photo_path(pid).write_text(data, encoding="utf-8")
        except OSError:
            return self._json(200, {"ok": False, "error": "Gagal simpan foto."})
        return self._json(200, {"ok": True})

    def _status(self) -> None:
        with _lock:
            doc = load_doc()
        ips = lan_ips()
        lines = [
            f"<p><b>Mesin:</b> {NAME}</p>",
            f"<p><b>Revisi data:</b> {(doc or {}).get('rev', 0)}</p>",
            f"<p><b>Update:</b> {(doc or {}).get('updatedAt', 'belum ada')}</p>",
        ]
        for ip in ips:
            lines.append(f'<p>Buka POS di tablet: <a href="http://{ip}:{PORT}/">http://{ip}:{PORT}/</a></p>')
        html = f"""<!doctype html><html lang="id"><head><meta charset="utf-8">
<title>HVEN Cloud</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{{font-family:ui-sans-serif,system-ui,sans-serif;background:#0c0b0a;color:#f4f0ea;margin:0;padding:2rem;line-height:1.5}}
a{{color:#c4a574}} card{{display:block}}
.box{{max-width:40rem;border:1px solid #3a342c;border-radius:12px;padding:1.5rem;background:#161310}}
</style></head><body><div class="box">
<h1>HVEN Cloud hidup</h1>
<p>Jangan tutup jendela ini selama toko buka.</p>
{''.join(lines)}
<p>Laptop dan PC boleh dua-duanya nyala. Tablet, HP manager, dan layar pantau <b>harus buka alamat mesin yang sama</b> (yang sedang dipakai).</p>
</div></body></html>"""
        raw = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _proxy(self) -> None:
        target = VERCEL + self.path
        headers = {
            "User-Agent": self.headers.get("User-Agent") or "HVEN-Cloud",
            "Accept": self.headers.get("Accept") or "*/*",
            "Accept-Language": self.headers.get("Accept-Language") or "id",
        }
        req = Request(target, headers=headers, method="GET")
        try:
            with urlopen(req, timeout=25) as resp:
                body = resp.read()
                self.send_response(resp.status)
                ct = resp.headers.get("Content-Type") or "application/octet-stream"
                self.send_header("Content-Type", ct)
                self.send_header("Cache-Control", resp.headers.get("Cache-Control") or "public, max-age=60")
                self._cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as err:
            body = err.read()
            self.send_response(err.code)
            self.send_header("Content-Type", err.headers.get("Content-Type") or "text/plain")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except URLError:
            msg = (
                "<!doctype html><meta charset=utf-8><body style='font-family:sans-serif;padding:2rem'>"
                "<h1>HVEN Cloud hidup</h1><p>Tampilan POS belum terambil. Buka "
                f"<a href='{VERCEL}'>{VERCEL}</a> atau muat ulang.</p></body>"
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self._cors()
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    PHOTOS.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    ips = lan_ips() or ["127.0.0.1"]
    print()
    print("=" * 56)
    print("  HVEN CLOUD  · ", NAME)
    print("=" * 56)
    print("  Jangan tutup jendela ini selama toko buka.")
    print()
    for ip in ips:
        print(f"  Buka di tablet / HP manager:")
        print(f"    http://{ip}:{PORT}/")
        print()
    print("  Status mesin ini:")
    print(f"    http://{ips[0]}:{PORT}/hven-cloud")
    print()
    print("  Laptop M4 dan PC memakai program yang sama.")
    print("  Nyalakan SATU yang dipakai hari itu, semua perangkat")
    print("  buka alamat yang tampil di layar mesin itu.")
    print("=" * 56)
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nHVEN Cloud berhenti.")
        httpd.server_close()


if __name__ == "__main__":
    main()
