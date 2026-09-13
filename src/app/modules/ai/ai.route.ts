import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { validateRequest } from "../../middlewares/validateRequest";
import { Role } from "../user/user.interface";
import { AiController } from "./ai.controller";
import { aiChatValidationSchema } from "./ai.validation";

const router = express.Router();

// Stage 29: only admins/managers can reach the AI assistant — a normal
// customer must never be able to hit this endpoint.
router.post(
  "/chat",
  checkAuth(Role.ADMIN, Role.MANAGER),
  validateRequest(aiChatValidationSchema),
  AiController.chat,
);

export const aiRoutes = router;
