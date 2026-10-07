// /* eslint-disable no-console */
// import { Server } from "http";
// import mongoose from "mongoose";
// import app from "./app";
// import { envVars } from "./app/config/env";
// import { seedAdmin } from "./app/utils/seedAdmin";
// import { startCourierCron } from "./app/cron/courier.cron";
// let server: Server;

// const startServer = async () => {
//   try {
//     await mongoose.connect(envVars.DB_URL);
//     console.log("Mongoose is connected!!!");

//     await seedAdmin();
//     startCourierCron();

//     server = app.listen(envVars.PORT, () => {
//       console.log(`Farin Fusion app is running on port ${envVars.PORT}`);
//     });
//   } catch (error) {
//     console.log(error);
//   }
// };

// startServer();
// process.on("unhandledRejection", (err) => {
//   console.log("uncaught error detected.... server shutting down", err);
//   if (server) {
//     server.close(() => {
//       process.exit(1);
//     });
//   }
// });

// process.on("uncaughtException", (err) => {
//   console.log("uncaught error detected.... server shutting down", err);
//   if (server) {
//     server.close(() => {
//       process.exit(1);
//     });
//   }
// });

// process.on("SIGTERM", () => {
//   console.log("Sigterm signal received.... server shutting down");
//   if (server) {
//     server.close(() => {
//       process.exit(1);
//     });
//   }
// });

// process.on("SIGINT", () => {
//   console.log("Sigint signal received.... server shutting down");
//   if (server) {
//     server.close(() => {
//       process.exit(1);
//     });
//   }
// });



/* eslint-disable no-console */
import { createServer, Server } from "http";
import mongoose from "mongoose";
import app from "./app";
import { envVars } from "./app/config/env";
import { startCourierCron } from "./app/cron/courier.cron";
import { FacebookServices } from "./app/modules/facebook/facebook.service";
import { initSocket } from "./app/socket/socket";
import { seedAdmin } from "./app/utils/seedAdmin";

// socket.io needs a raw http server, so app.listen() can't be used
const server: Server = createServer(app);

const startServer = async () => {
  try {
    await mongoose.connect(envVars.DB_URL);
    console.log("Mongoose is connected!!!");

    await seedAdmin();
    startCourierCron();
    initSocket(server);

    // socket.io needs a raw http server, so app.listen() can't be used
    setInterval(() => {
      FacebookServices.runSlaSweep().catch((err) =>
        console.error("FB SLA sweep error:", err),
      );
    }, 60 * 1000);

    server.listen(envVars.PORT, () => {
      console.log(`Farin Fusion app is running on port ${envVars.PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
};

startServer();

const shutdown = (message: string, err?: unknown) => {
  console.log(message, err ?? "");
  server.close(() => {
    process.exit(1);
  });
};

process.on("unhandledRejection", (err) =>
  shutdown("unhandled rejection detected.... server shutting down", err),
);
process.on("uncaughtException", (err) =>
  shutdown("uncaught exception detected.... server shutting down", err),
);
process.on("SIGTERM", () =>
  shutdown("Sigterm signal received.... server shutting down"),
);
process.on("SIGINT", () =>
  shutdown("Sigint signal received.... server shutting down"),
);