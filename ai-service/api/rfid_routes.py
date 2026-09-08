from flask import jsonify, request

from rfid.bridge import record_uid_via_http

def register_rfid_routes(app, scanner):
    @app.post('/api/rfid/scan/start')
    def start_scan():
        direction = (request.get_json(silent=True) or {}).get('direction', 'in')
        try:
            scanner.start(direction)
            return jsonify({'ok': True, **scanner.poll(direction)})
        except ValueError as exc:
            return jsonify({'ok': False, 'error': str(exc)}), 400

    @app.get('/api/rfid/scan/poll')
    def poll_scan():
        direction = request.args.get('direction', 'in')
        try:
            return jsonify({'ok': True, **scanner.poll(direction)})
        except ValueError as exc:
            return jsonify({'ok': False, 'error': str(exc)}), 400

    @app.post('/api/rfid/scan/cancel')
    def cancel_scan():
        direction = (request.get_json(silent=True) or {}).get('direction', 'in')
        try:
            scanner.cancel(direction)
            return jsonify({'ok': True, **scanner.poll(direction)})
        except ValueError as exc:
            return jsonify({'ok': False, 'error': str(exc)}), 400

    @app.post('/api/rfid/scan/record')
    def record_scan():
        """External bridge (ESP32) feeds a UID into the scanner."""
        body = request.get_json(silent=True) or {}
        uid = (body.get('uid') or '').strip()
        direction = (body.get('direction') or 'in').strip()
        if not uid:
            return jsonify({'ok': False, 'error': 'uid is required'}), 400
        ok = record_uid_via_http(scanner, direction, uid)
        if not ok:
            return jsonify({'ok': False, 'error': 'invalid direction'}), 400
        return jsonify({'ok': True, **scanner.poll(direction)})

    @app.get('/api/rfid/scan/state')
    def state_scan():
        direction = request.args.get('direction', 'in')
        try:
            return jsonify({'ok': True, **scanner.poll(direction)})
        except ValueError as exc:
            return jsonify({'ok': False, 'error': str(exc)}), 400

