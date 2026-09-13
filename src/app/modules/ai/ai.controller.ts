import { Request, Response } from "express";
import httpStatus from "http-status-codes";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AiService } from "./ai.service";

const chat = catchAsync(async (req: Request, res: Response) => {
  const { message, history } = req.body as {
    message: string;
    history?: { role: "user" | "model"; text: string }[];
  };

  const result = await AiService.chat(message, history ?? []);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "AI response generated successfully",
    data: result,
  });
});

export const AiController = {
  chat,
};
