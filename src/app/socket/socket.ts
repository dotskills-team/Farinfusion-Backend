/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";
import { Role } from "../modules/user/user.interface";

let io: Server | null = null;

const readCookie = (cookie: string | undefined, name: string) => {
  if (!cookie) return undefined;
  const found = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : undefined;
};

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL?.split(",") || "http://localhost:3000",
      credentials: true,
    },
  });

  // JWT verify: token na thakle ba invalid hole connect-i hobe na
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        readCookie(socket.handshake.headers.cookie, "accessToken");
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET as string,
      ) as JwtPayload;

      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  // Room backend-i thik kore, client na. Telesales/onno role kono Facebook room-e dhukbe na
  io.on("connection", (socket) => {
    const { userId, role } = socket.data;

    if (role === Role.ADMIN || role === Role.MANAGER) {
      socket.join("management");
    }
    if (role === Role.MODERATOR) {
      socket.join("moderators");
      socket.join(`user:${userId}`);
    }
  });

  return io;
};

export const emitToRooms = (
  rooms: (string | null | undefined)[],
  event: string,
  payload: any,
) => {
  const list = rooms.filter(Boolean) as string[];
  if (io && list.length) io.to(list).emit(event, payload);
};