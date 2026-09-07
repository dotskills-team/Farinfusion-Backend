import httpStatus from "http-status-codes";
import AppError from "../../../errorHelpers/appError";
import { CourierSettings } from "../../courierSettings/courierSettings.model";
import { CourierProvider } from "../../courierSettings/courierSettings.interface";

export const getCourierConfig = async (provider: CourierProvider) => {
  const settings = await CourierSettings.findOne({
    provider,
    isActive: true,
    isDeleted: false,
  });

  if (!settings) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      `${provider} courier settings not found`,
    );
  }

  const configMap = settings.config as any;

  const normalizedConfig = {
    apiKey: String(configMap.get("apiKey") ?? "").trim(),
    secretKey: String(configMap.get("secretKey") ?? "").trim(),
    username: String(configMap.get("username") ?? "").trim(),
    password: String(configMap.get("password") ?? "").trim(),
    baseUrl: String(configMap.get("baseUrl") ?? "").trim(),
    clientId: String(configMap.get("clientId") ?? "").trim(),
    clientSecret: String(configMap.get("clientSecret") ?? "").trim(),
  };

  return {
    ...settings.toObject(),
    config: normalizedConfig,
  };
};