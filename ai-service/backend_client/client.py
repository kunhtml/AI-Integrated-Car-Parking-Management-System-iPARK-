"""HTTP client for the Node.js iPARK backend."""
from __future__ import annotations

import requests

from config import BACKEND_URL, SERVICE_TOKEN

class BackendClient:
    def __init__(self, base_url: str = BACKEND_URL, token: str = SERVICE_TOKEN):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"X-Service-Token": token, "Content-Type": "application/json"})

    def _request(self, method: str, path: str, **kwargs):
        kwargs.setdefault("timeout", 10)
        return self.session.request(method, f"{self.base_url}/{path.lstrip('/')}", **kwargs)

    def health(self):
        try:
            response = self._request("GET", "/api/health")
            return response.ok
        except requests.RequestException:
            return False

    def push_camera_log(self, direction: str, detected_plate: str, image_path: str = "", **kwargs):
        if direction not in {"in", "out"}:
            raise ValueError("direction must be 'in' or 'out'")
        payload = {
            "direction": direction,
            "detectedPlate": detected_plate,
            "imagePath": image_path,
            **kwargs,
        }
        last_error = None
        for attempt in range(3):
            try:
                response = self._request("POST", "/api/bridge/log", json=payload, timeout=4)
                if response.ok:
                    try:
                        return response.json()
                    except ValueError:
                        return {"ok": True}
                last_error = f"HTTP {response.status_code}"
            except requests.RequestException as exc:
                last_error = str(exc)
        if last_error:
            print(f"[BACKEND][push_camera_log] failed: {last_error}")
        return None

    def control_gate(self, direction: str, action: str):
        if direction not in {"in", "out"}:
            raise ValueError("direction must be 'in' or 'out'")
        try:
            response = self._request("POST", "/api/camera-bridge/gate", json={"direction": direction, "action": action})
            return response.ok
        except requests.RequestException:
            return False
