import { Router } from "express";
import { createRfidCard, deleteRfidCard, exportAllCards, getRfidCard, listMyRfidCards, listRfidCards, listRfidAssignments, listUnassignedResidents, lookupByPlate, replaceActiveSessionRfid, lookupRfidCardByUid, registerScannedCard, setRfidCardStatus, updateRfidCard } from "../controllers/rfid.controller.js";
import { confirmSale, inventory, replaceCard, returnCard, sell, sellForCustomer, reconcilePending, reconcileCustomerSale, cardDetails, transactions, updateStatus } from "../controllers/rfidSales.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { listMyRfidIssues, createRfidIssue, listRfidIssues, updateRfidIssue } from "../controllers/rfidIssue.controller.js";
import { assignPurchaseCard, createPurchaseRequest, listMyPurchaseRequests, listPurchaseRequests, payPurchaseRequest, reconcilePurchaseRequest, reviewPurchaseRequest } from "../controllers/rfidPurchase.controller.js";
import { requireServiceToken } from "../middlewares/service-auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const rfidRoutes = Router();
rfidRoutes.use(requireAuth);
rfidRoutes.get("/mine", asyncHandler(listMyRfidCards));
rfidRoutes.get("/purchase-requests/mine", asyncHandler(listMyPurchaseRequests));
rfidRoutes.post("/purchase-requests", asyncHandler(createPurchaseRequest));
rfidRoutes.post("/purchase-requests/:id/pay", asyncHandler(payPurchaseRequest));
rfidRoutes.post("/purchase-requests/:id/reconcile", asyncHandler(reconcilePurchaseRequest));
rfidRoutes.get("/purchase-requests", requireRole("admin", "staff"), asyncHandler(listPurchaseRequests));
rfidRoutes.post("/purchase-requests/:id/review", requireRole("admin", "staff"), asyncHandler(reviewPurchaseRequest));
rfidRoutes.post("/purchase-requests/:id/assign", requireRole("admin", "staff"), asyncHandler(assignPurchaseCard));
rfidRoutes.get("/issue-requests/mine", asyncHandler(listMyRfidIssues));
rfidRoutes.post("/issue-requests", asyncHandler(createRfidIssue));
rfidRoutes.get("/issue-requests", requireRole("admin", "staff"), asyncHandler(listRfidIssues));
rfidRoutes.patch("/issue-requests/:id", requireRole("admin", "staff"), asyncHandler(updateRfidIssue));
rfidRoutes.get("/inventory", requireRole("admin", "staff"), asyncHandler(inventory));
rfidRoutes.get("/transactions", requireRole("admin", "staff"), asyncHandler(transactions));
rfidRoutes.get("/:id/details", requireRole("admin", "staff"), asyncHandler(cardDetails));
rfidRoutes.post("/sales", requireRole("admin", "staff"), asyncHandler(sell));
rfidRoutes.post("/my-sales", asyncHandler(sellForCustomer));
rfidRoutes.post("/sales/:transactionId/confirm", requireRole("admin", "staff"), asyncHandler(confirmSale));
rfidRoutes.post("/sales/reconcile-pending", requireRole("admin", "staff"), asyncHandler(reconcilePending));
rfidRoutes.post("/my-sales/:transactionId/reconcile", asyncHandler(reconcileCustomerSale));
rfidRoutes.post("/:id/return", requireRole("admin", "staff"), asyncHandler(returnCard));
rfidRoutes.post("/:id/replace", requireRole("admin", "staff"), asyncHandler(replaceCard));
rfidRoutes.get("/", requireRole("admin", "staff"), asyncHandler(listRfidCards));
rfidRoutes.get("/assignments", requireRole("admin", "staff"), asyncHandler(listRfidAssignments));
rfidRoutes.get("/unassigned-residents", requireRole("admin", "staff"), asyncHandler(listUnassignedResidents));
// Staff desk lookup after a plate is entered manually.
rfidRoutes.get("/by-plate/:plate", requireRole("admin", "staff"), asyncHandler(lookupByPlate));
rfidRoutes.post("/replace-active", requireRole("admin", "staff"), asyncHandler(replaceActiveSessionRfid));
// Card identity, owner, and vehicle association are administrative data.
// Staff may view cards and perform permitted operational status actions only.
rfidRoutes.post("/", requireRole("admin"), asyncHandler(createRfidCard));
rfidRoutes.get("/:id", requireRole("admin", "staff"), asyncHandler(getRfidCard));
rfidRoutes.patch("/:id", requireRole("admin"), asyncHandler(updateRfidCard));
rfidRoutes.delete("/:id", requireRole("admin"), asyncHandler(deleteRfidCard));
rfidRoutes.post("/:id/status", requireRole("admin", "staff"), asyncHandler(setRfidCardStatus));
rfidRoutes.post("/:id/:action", requireRole("admin", "staff"), asyncHandler(updateStatus));

const bridgeRfid = Router();
bridgeRfid.use(requireServiceToken);
bridgeRfid.get("/lookup/:uid", asyncHandler(lookupRfidCardByUid));
bridgeRfid.get("/by-plate/:plate", asyncHandler(lookupByPlate));
bridgeRfid.post("/scan", asyncHandler(registerScannedCard));
bridgeRfid.get("/export", asyncHandler(exportAllCards));
export { bridgeRfid };
