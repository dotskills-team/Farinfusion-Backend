/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { FacebookServices } from "./facebook.service";

/* ---------------- Webhook (catchAsync na, age 200 dite hobe) ---------------- */

const verifyWebhook = (req: Request, res: Response) => {
  const {
    "hub.mode": mode,
    "hub.verify_token": token,
    "hub.challenge": challenge,
  } = req.query;

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    return res.status(200).send(challenge as string);
  }
  return res.sendStatus(403);
};

const receiveWebhook = async (req: Request, res: Response) => {
  const raw = req.body as Buffer;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!FacebookServices.isValidSignature(raw, signature)) {
    return res.sendStatus(403);
  }

  // Facebook-ke taratari 200, processing pore
  res.sendStatus(200);

  try {
    await FacebookServices.handleWebhook(JSON.parse(raw.toString("utf8")));
  } catch (err) {
    console.error("FB webhook error:", err);
  }
};

/* ---------------- Inbox ---------------- */

const getConversations = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getConversations(
    req.user as JwtPayload,
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversations Retrieved Successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getMessages(
    req.user as JwtPayload,
    req.params.id as string,
    req.query.after as string | undefined,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages Retrieved Successfully",
    data: result,
  });
});

const replyToConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.replyToConversation(
    req.user as JwtPayload,
    req.params.id as string,
    req.body.text,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reply Sent Successfully",
    data: result,
  });
});

const claimConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.claimConversation(
    req.user as JwtPayload,
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation Claimed Successfully",
    data: result,
  });
});

const assignConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.assignConversation(
    req.user as JwtPayload,
    req.params.id as string,
    req.body.moderatorId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation Assigned Successfully",
    data: result,
  });
});

const transferConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.transferConversation(
    req.user as JwtPayload,
    req.params.id as string,
    req.body.toModeratorId,
    req.body.note,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation Transferred Successfully",
    data: result,
  });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.updateStatus(
    req.user as JwtPayload,
    req.params.id as string,
    req.body.status,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Conversation Status Updated",
    data: result,
  });
});

const linkLead = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.linkLead(
    req.user as JwtPayload,
    req.params.id as string,
    req.body.leadId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Lead Linked Successfully",
    data: result,
  });
});

const getAssignmentLogs = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getAssignmentLogs(
    req.params.id as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assignment Logs Retrieved Successfully",
    data: result,
  });
});

/* ---------------- Moderators, availability, settings, report ---------------- */

const getModerators = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getModerators();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Moderators Retrieved Successfully",
    data: result,
  });
});

const setAvailability = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.setAvailability(
    req.user as JwtPayload,
    req.body.chatStatus,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Availability Updated Successfully",
    data: result,
  });
});

const getSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getSettings();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Settings Retrieved Successfully",
    data: result,
  });
});

const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.updateSettings(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Settings Updated Successfully",
    data: result,
  });
});

const getReport = catchAsync(async (req: Request, res: Response) => {
  const result = await FacebookServices.getReport(
    req.query as Record<string, string>,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Report Retrieved Successfully",
    data: result,
  });
});

export const FacebookControllers = {
  verifyWebhook,
  receiveWebhook,
  getConversations,
  getMessages,
  replyToConversation,
  claimConversation,
  assignConversation,
  transferConversation,
  updateStatus,
  linkLead,
  getAssignmentLogs,
  getModerators,
  setAvailability,
  getSettings,
  updateSettings,
  getReport,
};