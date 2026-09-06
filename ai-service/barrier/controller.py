"""Barrier controller independent from camera and AI."""
from __future__ import annotations

import threading

from config import ESP32_IN_PORT, ESP32_OUT_PORT, SERIAL_BAUDRATE, GATE_AUTO_CLOSE_SECONDS
from core.state import state
from .serial_transport import SerialTransport

class BarrierController:
    def __init__(self):
        # Fallback khi RFID bridge không mở shared connection (ví dụ không
        # co serial port cau hinh). Windows chi cho MOT connection moi COM
        # port nen khong duoc mo transport rieng khi reader RFID da giu port.
        self.transports = {
            "in": SerialTransport(ESP32_IN_PORT, SERIAL_BAUDRATE),
            "out": SerialTransport(ESP32_OUT_PORT, SERIAL_BAUDRATE),
        }
        self._readers: dict = {}
        self._lock = threading.Lock()

    def set_reader(self, direction: str, reader) -> None:
        """Dung chung ket noi serial da mo cua RfidSerialBridge (khong tranh COM)."""
        with self._lock:
            self._readers[direction] = reader
            self.transports.pop(direction, None)

    def open(self, direction: str) -> bool:
        if direction not in self.transports and not self._has_reader(direction):
            return False
        ok = self._send(direction, "OPEN_GATE")
        if ok:
            state.barrier_open[direction] = True
            threading.Timer(GATE_AUTO_CLOSE_SECONDS, self.close, args=(direction,)).start()
        return ok

    def close(self, direction: str) -> bool:
        if direction not in self.transports and not self._has_reader(direction):
            return False
        ok = self._send(direction, "CLOSE_GATE")
        if ok:
            state.barrier_open[direction] = False
        return ok

    def _has_reader(self, direction: str) -> bool:
        with self._lock:
            return direction in self._readers

    def _send(self, direction: str, command: str) -> bool:
        with self._lock:
            reader = self._readers.get(direction)
        if reader is not None:
            return reader.write_line(command)
        return self.transports[direction].send(command)

    def is_open(self, direction: str) -> bool:
        return bool(state.barrier_open.get(direction, False))
