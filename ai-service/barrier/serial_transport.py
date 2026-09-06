"""Small serial transport abstraction for ESP32 barriers."""
from __future__ import annotations

import threading
import serial

class SerialTransport:
    def __init__(self, port: str, baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.connection = None
        self.lock = threading.Lock()

    def connect(self) -> bool:
        try:
            if self.connection is None or not self.connection.is_open:
                self.connection = serial.Serial(self.port, self.baudrate, timeout=1)
            return True
        except Exception:
            self.connection = None
            return False

    def send(self, command: str) -> bool:
        with self.lock:
            if not self.connect():
                return False
            try:
                self.connection.write((command.rstrip("\n") + "\n").encode())
                return True
            except Exception:
                return False

    def close(self) -> None:
        if self.connection and self.connection.is_open:
            self.connection.close()
