import express, { Request, Response } from "express"
// import { globalErrorHandler } from "./app/middlewares/globalErrorHandler"
import cors from "cors"
// import notFound from "./app/middlewares/notFound"
import cookieParser from "cookie-parser";
import { router } from "./app/routes";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import { envVars } from "./app/config/env";
// import { envVars } from "./app/config/env"
import dns from "dns"
import { facebookWebhookRoutes } from "./app/modules/facebook/facebook.route";
dns.setServers(["1.1.1.1", "8.8.8.8"])



const app = express()
app.use(cookieParser());
app.set("trust proxy", 1)
app.use(express.urlencoded({extended: true}))
app.use(cors({
     origin: [
        envVars.FRONTEND_URL,
        "https://farinfusion.com",
        "http://localhost:3000",
        
    ],
    credentials: true
}))

app.use("/api/v1/facebook/webhook", facebookWebhookRoutes);

app.use(express.json())

app.use("/api/v1", router)

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Farin Fusion application is running!!!"
    })
})

app.use(globalErrorHandler)

app.use(notFound)

export default app;