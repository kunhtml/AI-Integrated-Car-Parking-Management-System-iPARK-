import { FeedbackDocument } from "../models/Feedback.js";


export function serializeFeedback(feedback: FeedbackDocument) {
  return {
    id: feedback._id.toString(),
    subject: feedback.subject,
    content: feedback.content,
    status: feedback.status,
    response: feedback.response,
    createdBy: feedback.createdBy?.toString(),
    handledAt: feedback.handledAt,
    createdAt: feedback.createdAt,
  };
}

// Parking session serializer
export function serializeParkingSession(session: any) {
  return {
    id: session._id?.toString(),
    licensePlate: session.licensePlate,
    checkInAt: session.checkInAt,
    checkOutAt: session.checkOutAt,
    zone: session.zone,
    slot: session.slot,
    fee: session.fee,
    paid: session.paid,
    status: session.status,
    cameraId: session.cameraId,
    createdAt: session.createdAt,
  };
}

