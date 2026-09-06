"""Small serial RFID reader abstraction."""
from __future__ import annotations

import serial

class RfidReader:
    def __init__(self, port: str, baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.connection = None

    def connect(self) -> bool:
        try:
            if self.connection is None or not self.connection.is_open:
                self.connection = serial.Serial(self.port, self.baudrate, timeout=0.1)
            return True
        except (serial.SerialException, OSError):
            self.connection = None
            return False

    def read_line(self) -> str | None:
        if not self.connect():
            return None
        try:
            value = self.connection.readline().decode("utf-8", errors="ignore").strip()
            return value or None
        except (serial.SerialException, OSError):
            return None

    def write_line(self, value: str) -> bool:
        if not self.connect():
            return False
        try:
            self.connection.write((value.rstrip("\r\n") + "\n").encode("utf-8"))
            self.connection.flush()
            return True
        except (serial.SerialException, OSError):
            return False

    def close(self):
        if self.connection and self.connection.is_open:
            self.connection.close()
