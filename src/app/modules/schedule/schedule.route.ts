import express from "express";
import { ScheduleControllers } from "./schedule.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  createScheduleZodSchema,
  updateScheduleZodSchema,
} from "./schedule.validation";

const router = express.Router();

router.post(
  "/",
  checkAuth(...Object.values(Role)),
  validateRequest(createScheduleZodSchema),
  ScheduleControllers.createSchedule,
);

// /:id er age thakte hobe
router.get(
  "/my",
  checkAuth(...Object.values(Role)),
  ScheduleControllers.getMySchedules,
);

router.get(
  "/:id",
  checkAuth(...Object.values(Role)),
  ScheduleControllers.getSingleSchedule,
);

router.patch(
  "/:id",
  checkAuth(...Object.values(Role)),
  validateRequest(updateScheduleZodSchema),
  ScheduleControllers.updateSchedule,
);

router.delete(
  "/:id",
  checkAuth(...Object.values(Role)),
  ScheduleControllers.deleteSchedule,
);

export const scheduleRoutes = router;