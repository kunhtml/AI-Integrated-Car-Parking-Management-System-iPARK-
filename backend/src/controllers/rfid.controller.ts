import type { Request, Response } from "express";
import {
  registerRfidSchema,
  updateRfidStatusSchema,
  assignRfidSchema,
  scanRfidSchema,
  returnRfidSchema,
  listRfidSchema,
  listScanLogsSchema,
  confirmExitRfidSchema,
} from "../validations/rfid.validation.js";
import * as rfidService from "../services/rfid.service.js";
import { serializeParkingSession } from "../utils/serializers.js";

export async function registerRfid(request: Request, response: Response) {
  const { body } = registerRfidSchema.parse({ body: request.body });
  const card = await rfidService.registerCard(body.cardId, body.notes, request.user?.id);
  response.status(201).json({ card: serializeRfidCard(card) });
}

export async function listRfidCards(request: Request, response: Response) {
  const { query } = listRfidSchema.parse({ query: request.query });
  const result = await rfidService.listCards({
    status: query.status,
    search: query.search,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  });
  response.json({
    cards: result.cards.map(serializeRfidCard),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
}

export async function getRfidCardDetail(request: Request, response: Response) {
  const detail = await rfidService.getCardDetail(String(request.params.id));
  response.json({
    card: serializeRfidCard(detail.card),
    activeSession: detail.activeSession,
    scanCount: detail.scanCount,
  });
}

export async function updateRfidStatus(request: Request, response: Response) {
  const { params, body } = updateRfidStatusSchema.parse({
    params: request.params,
    body: request.body,
  });
  const card = await rfidService.updateCardStatus(
    params.id,
    body.status,
    body.blockedReason,
    body.notes,
  );
  response.json({ card: serializeRfidCard(card) });
}

export async function assignRfidCard(request: Request, response: Response) {
  const { body } = assignRfidSchema.parse({ body: request.body });
  const result = await rfidService.assignCardToSession(
    body.cardId,
    body.sessionId,
    body.gate,
    request.user?.id,
  );
  response.json({
    card: serializeRfidCard(result.card),
    sessionId: result.session._id?.toString(),
  });
}

export async function returnRfidCard(request: Request, response: Response) {
  const { body } = returnRfidSchema.parse({ body: request.body });
  const result = await rfidService.returnCard(body.cardId, body.sessionId, request.user?.id);
  response.json({
    card: serializeRfidCard(result.card),
    sessionId: result.session._id?.toString(),
  });
}

export async function scanRfidEntry(request: Request, response: Response) {
  const { body } = scanRfidSchema.parse({ body: request.body });
  const result = await rfidService.validateEntry(
    body.cardId,
    body.gate,
    request.user?.id,
    body.deviceId,
    body.plateDetected,
  );
  response.json({
    valid: true,
    card: serializeRfidCard(result.card),
    session: result.session ? serializeParkingSession(result.session) : undefined,
    message: result.message,
  });
}

export async function scanRfidExit(request: Request, response: Response) {
  const { body } = scanRfidSchema.parse({ body: request.body });
  const result = await rfidService.validateExit(
    body.cardId,
    body.gate,
    request.user?.id,
    body.deviceId,
    body.plateDetected,
  );
  response.json({
    valid: true,
    card: serializeRfidCard(result.card),
    session: result.session,
    mismatch: result.mismatch,
  });
}

export async function confirmExitRfid(request: Request, response: Response) {
  const { body } = confirmExitRfidSchema.parse({ body: request.body });
  const result = await rfidService.confirmExitWithMismatch(
    body.cardId,
    body.sessionId,
    body.action,
    request.user?.id,
  );
  response.json({
    confirmed: result.confirmed,
    card: serializeRfidCard(result.card),
    session: result.session,
  });
}

export async function reportLostCard(request: Request, response: Response) {
  const card = await rfidService.reportLostCard(String(request.params.id), request.user?.id);
  response.json({ card: serializeRfidCard(card) });
}

export async function unblockCard(request: Request, response: Response) {
  const card = await rfidService.unblockCard(String(request.params.id), request.user?.id);
  response.json({ card: serializeRfidCard(card) });
}

export async function listScanLogs(request: Request, response: Response) {
  const { query } = listScanLogsSchema.parse({ query: request.query });
  const result = await rfidService.listScanLogs({
    cardId: query.cardId,
    action: query.action,
    status: query.status,
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
  });
  response.json({
    logs: result.logs.map(serializeScanLog),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
}

export async function getCardHistory(request: Request, response: Response) {
  const card = await rfidService.getCardDetail(String(request.params.id));
  const history = await rfidService.getCardAssignmentHistory(card.card.cardId);
  response.json({
    card: serializeRfidCard(card.card),
    sessions: history.sessions,
    scans: history.scans.map(serializeScanLog),
  });
}

// ───────── Serializers ─────────

function serializeRfidCard(card: any) {
  return {
    id: card._id?.toString?.() || card.id || "",
    cardId: card.cardId,
    status: card.status,
    issuedAt: card.issuedAt,
    lastUsedAt: card.lastUsedAt,
    lostAt: card.lostAt,
    blockedAt: card.blockedAt,
    blockedReason: card.blockedReason,
    notes: card.notes,
    createdBy: card.createdBy?.name || card.createdBy?.email || card.createdBy?.toString?.(),
    createdAt: card.createdAt,
  };
}

function serializeScanLog(log: any) {
  return {
    id: log._id?.toString?.() || log.id || "",
    cardId: log.cardId,
    action: log.action,
    sessionId: log.sessionId?._id?.toString?.() || log.sessionId?.toString?.() || undefined,
    sessionPlate: log.sessionId?.plate,
    sessionSlot: log.sessionId?.slot,
    deviceId: log.deviceId?.toString?.() || undefined,
    performedBy: log.performedBy?.name || log.performedBy?.email || log.performedBy?.toString?.(),
    status: log.status,
    failureReason: log.failureReason,
    plateDetected: log.plateDetected,
    metadata: log.metadata,
    createdAt: log.createdAt,
  };
}
