
import express, { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { validateRequest } from "../../middlewares/validateRequest";
import { Role } from "../user/user.interface";
import { FacebookControllers } from "./facebook.controller";
import {
  assignZodSchema,
  availabilityZodSchema,
  linkLeadZodSchema,
  reactZodSchema,
  replyZodSchema,
  settingsZodSchema,
  statusZodSchema,
  transferZodSchema,
} from "./facebook.validation";

// Telesales ar onno role-er Facebook chat-e kono access nei
const MANAGEMENT = [Role.ADMIN, Role.MANAGER];
const CHAT_ROLES = [Role.ADMIN, Role.MANAGER, Role.MODERATOR];

/* Webhook: app.ts-e express.json()-er AGE mount korte hobe (raw body lage) */
export const facebookWebhookRoutes = Router();
facebookWebhookRoutes.get("/", FacebookControllers.verifyWebhook);
facebookWebhookRoutes.post(
  "/",
  express.raw({ type: "application/json" }),
  FacebookControllers.receiveWebhook,
);

/* Inbox */
const router = Router();

router.get(
  "/conversations",
  checkAuth(...CHAT_ROLES),
  FacebookControllers.getConversations,
);
router.get(
  "/conversations/:id/messages",
  checkAuth(...CHAT_ROLES),
  FacebookControllers.getMessages,
);
router.post(
  "/conversations/:id/reply",
  checkAuth(...CHAT_ROLES),
  validateRequest(replyZodSchema),
  FacebookControllers.replyToConversation,
);
router.post(
  "/conversations/:id/react",
  checkAuth(...CHAT_ROLES),
  validateRequest(reactZodSchema),
  FacebookControllers.reactToMessage,
);
router.patch(
  "/conversations/:id/claim",
  checkAuth(Role.MODERATOR),
  FacebookControllers.claimConversation,
);
router.patch(
  "/conversations/:id/assign",
  checkAuth(...MANAGEMENT),
  validateRequest(assignZodSchema),
  FacebookControllers.assignConversation,
);
router.patch(
  "/conversations/:id/transfer",
  checkAuth(...CHAT_ROLES),
  validateRequest(transferZodSchema),
  FacebookControllers.transferConversation,
);
router.patch(
  "/conversations/:id/status",
  checkAuth(...CHAT_ROLES),
  validateRequest(statusZodSchema),
  FacebookControllers.updateStatus,
);
router.patch(
  "/conversations/:id/link-lead",
  checkAuth(...CHAT_ROLES),
  validateRequest(linkLeadZodSchema),
  FacebookControllers.linkLead,
);
router.get(
  "/conversations/:id/logs",
  checkAuth(...MANAGEMENT),
  FacebookControllers.getAssignmentLogs,
);

router.get(
  "/moderators",
  checkAuth(...CHAT_ROLES),
  FacebookControllers.getModerators,
);
router.patch(
  "/availability",
  checkAuth(Role.MODERATOR),
  validateRequest(availabilityZodSchema),
  FacebookControllers.setAvailability,
);

router.get(
  "/settings",
  checkAuth(...MANAGEMENT),
  FacebookControllers.getSettings,
);
router.patch(
  "/settings",
  checkAuth(Role.ADMIN),
  validateRequest(settingsZodSchema),
  FacebookControllers.updateSettings,
);

router.get("/report", checkAuth(...MANAGEMENT), FacebookControllers.getReport);

export const facebookRoutes = router;