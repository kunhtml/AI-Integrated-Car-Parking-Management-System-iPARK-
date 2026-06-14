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

