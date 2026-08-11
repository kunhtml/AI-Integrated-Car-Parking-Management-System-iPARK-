# AI Knowledge Base — iPARK

> High-quality, production-grade documentation for the AI components of the iPARK system.
> Inspired by rigorous patterns from Anthropic Skills standards (references, pushy descriptions, evaluation frameworks, failure catalogs).

This folder contains focused, actionable references for the AI Service (`ai-service/`).

## Goals

- Make AI decisions transparent and reproducible
- Enable systematic evaluation and continuous improvement
- Capture rich telemetry for debugging and metrics
- Document "why" behind every design choice (hybrid detection, fallback strategy, etc.)

## File Overview

| File | Purpose | Priority |
|------|---------|----------|
| [detection-strategy.md](detection-strategy.md) | Pushy decision guide: when to use each detection method | High |
| [failure-cases.md](failure-cases.md) | Catalog of hard cases with examples and mitigations | High |
| [reproducibility.md](reproducibility.md) | Logging, image hashing, deterministic runs | High |
| [evaluation-framework.md](evaluation-framework.md) | Eval harness, blind review, metrics | High |
| [capability-registry.md](capability-registry.md) | Modular capabilities + model registry (planned) | Medium |
| [telemetry-and-logging.md](telemetry-and-logging.md) | What data to capture in RecognitionLog | High |

## Quick Start for Contributors

1. Read `detection-strategy.md` before changing plate or occupancy logic.
2. When adding new models or thresholds, update this knowledge base.
3. Always capture `imageHash`, `detectionMethod`, `confidence`, model versions.
4. Add new failure cases to `failure-cases.md` with real images from `ai-service/anh/`.

## Current AI Capabilities (Summary)

- **License Plate Recognition** (`/detect`)
  - 3-tier fallback: plate-model → vehicle-contour → full-image-ocr
  - Rich output: `detectionMethod`, `confidence`, `imageHash`, `vehicleType`

- **Occupancy & Wrong Parking Detection** (`/detect-occupancy`, `/detect-cars`)
  - 4 modes: `aerial` (default), `hybrid`, `seg`, `coco`
  - Uses Shapely for precise overlap/straddle measurement

- **Supporting**: Snapshot capture, vehicle type heuristic, average hash dedup

## Planned / Future Documents

- `capability-registry.md` — formal registry of every capability (plate recognition, occupancy, wrong-parking, snapshot, etc.) with inputs/outputs/contracts. Useful for modularization and future micro-services split.
- `metrics-dashboard.md` — spec for an internal AI quality dashboard (accuracy trends, method distribution, latency, top failures).

---

**Last updated**: 2026-07-23
**Maintained by**: AI team + coding agents
