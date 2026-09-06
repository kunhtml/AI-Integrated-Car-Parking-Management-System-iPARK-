from flask import jsonify, request

def register_barrier_routes(app, barrier):
    # Frontend gọi theo hợp đồng cũ /gate/<in|out>/<open|close>
    # (xem comments trong cameras-view.tsx) — giữ cả 2 alias.
    @app.post('/api/barrier/<direction>/<action>')
    @app.post('/gate/<direction>/<action>')
    def barrier_action(direction, action):
        if direction not in {'in', 'out'} or action not in {'open', 'close'}:
            return jsonify({'ok': False, 'error': 'invalid direction or action'}), 400
        ok = barrier.open(direction) if action == 'open' else barrier.close(direction)
        return jsonify({'ok': ok, 'direction': direction, 'action': action}), (200 if ok else 503)
