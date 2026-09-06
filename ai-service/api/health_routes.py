from flask import jsonify

from core.state import state

def register_health_routes(app, orchestrator=None):
    if orchestrator is not None:
        orchestrator.attach_routes(app)
    @app.get('/api/cameras/health')
    def cameras_health():
        return jsonify({
            'ok': True,
            'service': 'ipark-ai',
            'running': bool(orchestrator and orchestrator.running),
            'detectedPlates': dict(state.detected_plates),
            'snapshots': dict(state.snapshots),
        })

    @app.get('/api/plates/<direction>')
    def plate_status(direction: str):
        if direction not in {'in', 'out'}:
            return jsonify({'ok': False, 'error': 'invalid direction'}), 400
        return jsonify({
            'ok': True,
            'direction': direction,
            'detectedPlate': state.detected_plates.get(direction, ''),
            'imagePath': state.snapshots.get(direction, ''),
        })

    @app.get('/api/plates')
    def plates_index():
        return jsonify({
            'ok': True,
            'detectedPlates': dict(state.detected_plates),
            'snapshots': dict(state.snapshots),
        })
