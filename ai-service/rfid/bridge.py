"""Optional background readers that feed the in-memory RfidScanner.

Two transports are supported:

- Serial: a background thread per ``(direction, port)`` reads every
  line that begins with ``UID:`` from the configured COM port and
  pushes the UID into the scanner state for that direction. Configure
  with one of these env vars (priority high to low):

    * ``RFID_SERIAL_PORTS`` = ``in=COM11:115200,out=COM14:115200``
    * ``RFID_SERIAL_PORTS`` = ``COM11,COM14`` (defaults to ``in`` then ``out``)
    * ``RFID_SERIAL_PORT`` = ``COM11`` (single port, mapped to ``in``)

- HTTP: external devices (e.g. ESP32) can POST
  ``/api/rfid/scan/record`` with ``uid`` and ``direction`` to feed the
  scanner without needing a serial port on the AI host.
"""
from __future__ import annotations

import threading
import time
import re
from typing import Optional

from rfid.reader import RfidReader
from rfid.scanner import RfidScanner


def detect_rfid_port_spec(baudrate: int = 9600, timeout: float = 2.5) -> str:
    """Tự dò port COM của ESP32 RFID theo ID thiết bị (``ID:IN`` / ``ID:OUT``).

    Quét tất cả port serial, mở từng port, gửi lệnh ``GET_ID``, đọc phản hồi.
    Firmware trả về ``ID:IN`` hoặc ``ID:OUT`` -> ánh xạ port theo hướng.
    Cách này KHÔNG phụ thuộc số COM, giải quyết vấn đề Windows gán lại số COM
    mỗi khi rút/cắm USB hoặc reboot.

    Trả về chuỗi port spec dạng ``in=COM11:9600,out=COM15:9600``.
    Nếu không tìm thấy thiết bị -> trả về ``""`` (gọi dùng fallback về .env).
    """
    try:
        import serial
        from serial.tools import list_ports
    except ImportError:
        print("[RFID][detect] pyserial unavailable, skip auto-detect")
        return ""

    ports = [p.device for p in list_ports.comports()]
    if not ports:
        print("[RFID][detect] no serial ports found")
        return ""

    found: dict[str, str] = {}  # direction -> port
    for port in ports:
        if port in found.values():
            continue
        conn = None
        try:
            # dsrdtr/rtscts=False để hạn chế toggle DTR/RTS gây reset ESP32.
            conn = serial.Serial(port, baudrate, timeout=timeout,
                                 dsrdtr=False, rtscts=False)
            time.sleep(0.4)  # chờ thiết bị ổn định / boot (nếu bị reset)
            conn.reset_input_buffer()
            conn.write(b"GET_ID\n")
            conn.flush()
            # Đọc phản hồi trong cửa sổ timeout. Gửi lại GET_ID 1 lần nếu
            # thiết bị chưa kịp boot xong.
            deadline = time.time() + timeout
            resent = False
            response = ""
            while time.time() < deadline:
                if conn.in_waiting:
                    line = conn.readline().decode("utf-8", errors="ignore").strip()
                    if line.startswith("ID:"):
                        response = line
                        break
                if not resent and time.time() > deadline - 1.0:
                    conn.write(b"GET_ID\n")
                    conn.flush()
                    resent = True
        except (serial.SerialException, OSError):
            continue
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

        if response.startswith("ID:"):
            device_id = response[3:].strip().upper()
            if device_id == "IN" and "in" not in found:
                found["in"] = port
                print(f"[RFID][detect] {port} -> IN")
            elif device_id == "OUT" and "out" not in found:
                found["out"] = port
                print(f"[RFID][detect] {port} -> OUT")

    if not found:
        print("[RFID][detect] no RFID device identified (ID:IN/ID:OUT not found)")
        return ""

    parts = [f"{d}={found[d]}:{baudrate}" for d in ("in", "out") if d in found]
    return ",".join(parts)


def parse_port_spec(spec: str, default_direction: str | None = None) -> list[tuple[str, str, int]]:
    """Parse ``in=COM11:115200,out=COM14`` into [(direction, port, baudrate), ...]."""
    if not spec:
        return []
    out: list[tuple[str, str, int]] = []
    directions = ("in", "out")
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        direction = default_direction
        port = chunk
        baudrate = 115200
        if "=" in chunk:
            dir_part, rest = chunk.split("=", 1)
            direction = dir_part.strip().lower()
            chunk = rest.strip()
        if ":" in chunk:
            port_part, baud_part = chunk.rsplit(":", 1)
            port = port_part.strip()
            try:
                baudrate = int(baud_part.strip())
            except ValueError:
                baudrate = 115200
        else:
            port = chunk
        if direction is None:
            direction = directions[len(out)] if len(out) < len(directions) else "in"
        if direction not in {"in", "out"}:
            continue
        out.append((direction, port, baudrate))
    return out


class RfidSerialBridge:
    """Reads UID lines from one or more serial RFID readers."""

    def __init__(self, scanner: RfidScanner, port_spec: str):
        self.scanner = scanner
        self.port_spec = port_spec
        self._threads: list[tuple[str, threading.Thread, RfidReader, threading.Event]] = []
        self._configured = parse_port_spec(port_spec)
        self._lock = threading.Lock()

    def start(self) -> bool:
        if not self._configured:
            print("[RFID][serial] no ports configured")
            return False
        ok_any = False
        with self._lock:
            for direction, port, baudrate in self._configured:
                reader = RfidReader(port=port, baudrate=baudrate)
                if not reader.connect():
                    print(f"[RFID][serial] cannot open {port}; lane {direction} disabled")
                    continue
                stop = threading.Event()
                thread = threading.Thread(
                    target=self._loop,
                    args=(direction, reader, stop),
                    daemon=True,
                    name=f"rfid-serial-{direction}-{port}",
                )
                thread.start()
                self._threads.append((direction, thread, reader, stop))
                print(f"[RFID][serial] listening on {port} @ {baudrate} (direction={direction})")
                ok_any = True
        return ok_any

    def stop(self) -> None:
        with self._lock:
            for _, _thread, reader, stop in self._threads:
                stop.set()
                try:
                    reader.close()
                except Exception:
                    pass
            self._threads.clear()

    def _loop(self, direction: str, reader: RfidReader, stop: threading.Event) -> None:
        last_log_ts = 0.0
        scan_command_sent = False
        last_scan_command_ts = 0.0
        while not stop.is_set():
            # Firmware chỉ phát UID khi đang bật SCAN_ON và GIỮ scanMode cho tới
            # khi đọc được thẻ (hoặc nhận SCAN_OFF). Vì vậy chỉ cần gửi SCAN_ON
            # MỘT LẦN lúc frontend bật quét; các lần sau chỉ là safety net cho
            # trường hợp ESP32 bị reset / sót lệnh — gửi lại mỗi 10s và KHÔNG log
            # (trước đây gửi + log mỗi 2s gây spam serial/log).
            scanning = self.scanner.state(direction).get("enabled", False)
            if scanning and (
                not scan_command_sent or time.time() - last_scan_command_ts >= 10.0
            ):
                first_send = not scan_command_sent
                if reader.write_line("SCAN_ON"):
                    last_scan_command_ts = time.time()
                    if first_send:
                        print(f"[RFID][serial] {reader.port} -> SCAN_ON (bật chế độ quét)")
                scan_command_sent = True
            elif not scanning and scan_command_sent:
                reader.write_line("SCAN_OFF")
                scan_command_sent = False
                last_scan_command_ts = 0.0
            try:
                line = reader.read_line()
            except Exception as exc:
                print(f"[RFID][serial] {reader.port} read error: {exc}")
                time.sleep(0.5)
                continue
            if not line:
                time.sleep(0.05)
                continue
            now = time.time()
            # Chỉ log dòng "sinh" từ thiết bị; bỏ qua echo của chính lệnh
            # SCAN_ON/SCAN_OFF mà Python vừa gửi (firmware in lại
            # "Raw from Python: ..." và "OK|SCAN_ON" gây spam).
            if now - last_log_ts > 5.0 and not self._is_self_echo(line):
                print(f"[RFID][serial] {reader.port} raw line: {line!r}")
                last_log_ts = now
            uid = self._extract_uid(line)
            if not uid:
                continue
            try:
                self.scanner.record(direction, uid)
                print(f"[RFID][serial] {reader.port} -> {direction} UID={uid}")
            except ValueError as exc:
                print(f"[RFID][serial] record error: {exc}")

    @staticmethod
    def _is_self_echo(line: str) -> bool:
        """True nếu dòng này là echo của lệnh do Python gửi HOẶC dòng debug
        từ firmware (không phải dữ liệu thẻ) -> bỏ qua để không spam log."""
        s = (line or "").strip()
        if s.startswith("Raw from Python") or s in ("OK|SCAN_ON", "OK|SCAN_OFF"):
            return True
        # Dòng chẩn đoán / boot từ firmware (ghost detection, PCD_ID, CLEARDATA...)
        # là bình thường khi không có thẻ -> không cần log.
        if s.startswith("[RFID-DIAG]") or s.startswith("CLEARDATA"):
            return True
        return False

    @staticmethod
    def _extract_uid(line: str) -> str:
        """Tolerate ESP32/Arduino firmware that may or may not prefix the UID.

        Accepts: ``UID:60A99999``, ``60A99999``, ``CARD: 04 ab cd ef``, or any
        token that looks like a hex/alphanumeric id (>= 4 chars).
        """
        if not line:
            return ""
        text = line.strip()
        lowered = text.lower()
        # KHÔNG dùng prefix "id:" — dòng ID:IN/ID:OUT là danh tính thiết bị
        # (dùng cho auto-detect port), không phải UID thẻ.
        for prefix in ("uid:", "uid=", "card:", "rfid:"):
            if lowered.startswith(prefix):
                return text[len(prefix):].strip()
        # Không nhận các dòng LCD/debug từ ESP32 (ví dụ ``CLEARDATA``,
        # ``LABEL``, ``Thẻ không hợp lệ!``). UID RC522 là chuỗi hex.
        # Chỉ lấy token hex dài tối thiểu 8 ký tự để tránh ghi nhầm chữ
        # giao diện thành UID hợp lệ.
        for token in text.replace(",", " ").split():
            cleaned = token.strip().strip("\r:;|()[]")
            if len(cleaned) < 8 or len(cleaned) > 20:
                continue
            if re.fullmatch(r"[0-9A-Fa-f]+", cleaned):
                return cleaned.upper()
        return ""


def record_uid_via_http(scanner: RfidScanner, direction: str, uid: str) -> bool:
    """Allow external bridges (ESP32) to feed the scanner over HTTP."""
    direction = direction or "in"
    if direction not in {"in", "out"}:
        return False
    uid = (uid or "").strip()
    if not uid:
        return False
    scanner.record(direction, uid)
    return True
