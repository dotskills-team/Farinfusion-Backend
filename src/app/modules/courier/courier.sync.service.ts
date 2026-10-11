import { Courier } from "./courier.model";
import { CourierDeliveryStatus } from "./courier.interface";
import { getCourierProvider } from "./providers/courier.factory";

const syncActiveCouriers = async () => {
  const activeCouriers = await Courier.find({
    trackingCode: { $exists: true, $ne: null },

    deliveryStatus: {
      $nin: [
        CourierDeliveryStatus.DELIVERED,
        CourierDeliveryStatus.CANCELLED,
      ],
    },
  })
    .select("trackingCode courierName")
    .lean();

  console.log(`📦 Syncing ${activeCouriers.length} active couriers...`);

  for (const courier of activeCouriers) {
    try {
      if (!courier.trackingCode) continue;

      const provider = getCourierProvider(courier.courierName);

      await provider.trackCourier(courier.trackingCode);
    } catch (err) {
      // console.error(
      //   `❌ Sync failed: ${courier.courierName} - ${courier.trackingCode}`,
      // );
    }
  }
};

export const CourierSyncService = {
  syncActiveCouriers,
};