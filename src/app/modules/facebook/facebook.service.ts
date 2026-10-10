
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import httpStatus from "http-status-codes";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errorHelpers/appError";
import { emitToRooms } from "../../socket/socket";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { IsActive, Role } from "../user/user.interface";
import { User } from "../user/user.model";
import { FbAssignType, FbConvStatus } from "./facebook.interface";
import {
  FbAssignmentLog,
  FbConversation,
  FbRecentMessage,
  FbReplyLog,
  FbSettings,
} from "./facebook.model";

const DAY = 24 * 60 * 60 * 1000;
const MANAGEMENT_ROLES: string[] = [Role.ADMIN, Role.MANAGER];
const isManagement = (role: string) => MANAGEMENT_ROLES.includes(role);
// Everyone with chat access sees every conversation, so events go to all of them
const CHAT_ROOMS = ["management", "moderators"];
const sameId = (a: any, b: any) => String(a ?? "") === String(b ?? "");

/* ------------------------------------------------------------------ */
/* Meta Graph API                                                      */
/* ------------------------------------------------------------------ */

const graphUrl = (path: string) =>
  `https://graph.facebook.com/${process.env.FB_GRAPH_VERSION || "v23.0"}/${path}`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fbFetch = async (path: string, init: RequestInit = {}) => {
  // Only GET requests are retried. Retrying a send could duplicate the message
  const isGet = !init.method || init.method === "GET";
  const maxAttempts = isGet ? 3 : 1;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(graphUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.FB_PAGE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const data: any = await res.json();
    if (res.ok) return data;

    const err = data?.error;

    // Meta sometimes returns a transient "unknown error" (code 1 / 2),
    // most often right after a brand-new conversation is created
    const transient = err?.is_transient || err?.code === 1 || err?.code === 2;
    if (transient && attempt < maxAttempts) {
      await sleep(800 * attempt);
      continue;
    }

    // eslint-disable-next-line no-console
    console.error(
      "Facebook API error:",
      path.split("?")[0],
      JSON.stringify(err),
    );
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      err?.message || "Facebook API error",
    );
  }
};

const sendFbText = async (psid: string, text: string, humanAgent: boolean) =>
  fbFetch("me/messages", {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: psid },
      ...(humanAgent
        ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" }
        : { messaging_type: "RESPONSE" }),
      message: { text },
    }),
  }) as Promise<{ recipient_id: string; message_id: string }>;

// Messenger's Send API only accepts an emoji as the reaction (named values like
// "love" work on Instagram only), so map our reaction names to emoji
const REACTION_EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  smile: "😆",
  wow: "😮",
  sad: "😢",
  angry: "😠",
};

// react / unreact sender actions of the Send API. reaction = null removes ours
const sendFbReaction = async (
  psid: string,
  messageId: string,
  reaction: string | null,
) =>
  fbFetch("me/messages", {
    method: "POST",
    body: JSON.stringify({
      recipient: { id: psid },
      sender_action: reaction ? "react" : "unreact",
      payload: reaction
        ? {
            message_id: messageId,
            reaction: REACTION_EMOJI[reaction] ?? reaction,
          }
        : { message_id: messageId },
    }),
  });

const getFbProfile = async (psid: string) => {
  try {
    const d = await fbFetch(`${psid}?fields=first_name,last_name,profile_pic`);
    return {
      name: `${d.first_name || ""} ${d.last_name || ""}`.trim(),
      profilePic: d.profile_pic as string | undefined,
    };
  } catch {
    return null;
  }
};

const getFbThreadId = async (psid: string): Promise<string | null> => {
  try {
    const d = await fbFetch(
      `${process.env.FB_PAGE_ID}/conversations?platform=messenger&user_id=${psid}&fields=id`,
    );
    if (d?.data?.[0]?.id) return d.data[0].id;
  } catch {
    // The user_id lookup can fail for brand-new threads, so fall back below
  }

  // Fallback: scan recent conversations and match the customer by participant id
  const d = await fbFetch(
    `${process.env.FB_PAGE_ID}/conversations?platform=messenger&fields=id,participants&limit=50`,
  );
  const match = (d?.data || []).find((c: any) =>
    c.participants?.data?.some((p: any) => p.id === psid),
  );
  return match?.id || null;
};

const getFbThreadMessages = async (threadId: string, after?: string) => {
  const params = new URLSearchParams({
    fields:
      "id,message,from,created_time,attachments{mime_type,name,image_data,file_url}",
    limit: "30",
  });
  if (after) params.set("after", after);
  const d = await fbFetch(`${threadId}/messages?${params.toString()}`);
  return {
    messages: (d.data || []) as any[],
    nextCursor: (d.paging?.next ? d.paging?.cursors?.after : null) as
      string | null,
  };
};

const isValidSignature = (raw: Buffer, signature?: string) => {
  if (!signature || !process.env.FB_APP_SECRET) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", process.env.FB_APP_SECRET)
      .update(raw)
      .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const getSettings = async () =>
  FbSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

const updateSettings = async (payload: Record<string, any>) =>
  FbSettings.findOneAndUpdate({ key: "default" }, payload, {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });

/* ------------------------------------------------------------------ */
/* Assignment engine                                                   */
/* ------------------------------------------------------------------ */

const assignTo = async (
  convo: any,
  moderatorId: any | null,
  type: FbAssignType,
  by?: string | null,
  note?: string,
) => {
  const from = convo.assignedTo || null;
  const nextStatus = moderatorId ? FbConvStatus.OPEN : FbConvStatus.UNASSIGNED;

  if (sameId(from, moderatorId) && convo.status === nextStatus) return convo;

  convo.assignedTo = moderatorId;
  convo.assignedAt = moderatorId ? new Date() : null;
  convo.status = nextStatus;
  convo.slaNotified = false;
  // Notun assignee-ke pura SLA time dewa hobe
  if (moderatorId && convo.awaitingReplySince) {
    convo.awaitingReplySince = new Date();
  }
  await convo.save();

  if (!sameId(from, moderatorId)) {
    await FbAssignmentLog.create({
      conversation: convo._id,
      from,
      to: moderatorId,
      by: by || null,
      type,
      note,
    });
  }

  emitToRooms(CHAT_ROOMS, "fb:assignment", {
    conversationId: convo._id,
    assignedTo: moderatorId,
  });
  return convo;
};

// Online moderator-der moddhe jar open chat shobcheye kom (limit nei)
const pickModerator = async (exclude: string[] = []) => {
  const mods = await User.find({
    role: Role.MODERATOR,
    chatStatus: "ONLINE",
    isActive: IsActive.ACTIVE,
    isDeleted: false,
    _id: { $nin: exclude },
  }).select("_id");
  if (!mods.length) return null;

  const counts = await FbConversation.aggregate([
    {
      $match: {
        status: FbConvStatus.OPEN,
        assignedTo: { $in: mods.map((m) => m._id) },
      },
    },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  const load = (id: any) => countMap.get(String(id)) || 0;
  const min = Math.min(...mods.map((m) => load(m._id)));
  const candidates = mods.filter((m) => load(m._id) === min);
  return candidates[Math.floor(Math.random() * candidates.length)]._id;
};

const routeConversation = async (
  convo: any,
  opts: { exclude?: string[]; type?: FbAssignType; note?: string } = {},
) => {
  const settings: any = await getSettings();
  const moderatorId = settings.autoAssign
    ? await pickModerator(opts.exclude)
    : null;

  return assignTo(
    convo,
    moderatorId,
    moderatorId ? opts.type || FbAssignType.AUTO : FbAssignType.RELEASE,
    null,
    opts.note,
  );
};

// Sticky: age jar kase chhilo she online thakle sei pabe, noile notun kore route
const ensureActiveAssignment = async (convo: any) => {
  if (convo.assignedTo) {
    const mod = await User.findOne({
      _id: convo.assignedTo,
      chatStatus: "ONLINE",
      isActive: IsActive.ACTIVE,
      isDeleted: false,
    }).select("_id");

    if (mod) {
      if (convo.status !== FbConvStatus.OPEN) {
        convo.status = FbConvStatus.OPEN;
        await convo.save();
      }
      return convo;
    }
  }
  return routeConversation(convo);
};

const getActiveModerator = async (id: string) => {
  const mod = await User.findOne({
    _id: id,
    role: Role.MODERATOR,
    isActive: IsActive.ACTIVE,
    isDeleted: false,
  }).select("_id name");
  if (!mod) {
    throw new AppError(httpStatus.BAD_REQUEST, "Active moderator not found");
  }
  return mod;
};

// Admin, manager and moderators can all see and reply to every conversation
const getConvo = async (id: string) => {
  const convo = await FbConversation.findById(id);
  if (!convo) {
    throw new AppError(httpStatus.NOT_FOUND, "Conversation not found");
  }
  return convo;
};

/* ------------------------------------------------------------------ */
/* Webhook                                                             */
/* ------------------------------------------------------------------ */

const webhookAttachments = (msg: any) =>
  (msg.attachments || []).map((a: any) => ({
    type: a.type,
    name: a.payload?.title,
    url: a.payload?.url,
  }));

const handleWebhook = async (body: any) => {
  if (body.object !== "page") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const msg = event.message;
      if (!msg) continue;

      const isEcho = !!msg.is_echo; // Page theke (FB inbox/app) pathano
      const psid = isEcho ? event.recipient.id : event.sender.id;

      let convo: any = await FbConversation.findOne({ psid });
      let isNew = false;

      if (!convo) {
        const profile = await getFbProfile(psid);
        convo = await FbConversation.create({
          psid,
          customerName: profile?.name || "Facebook User",
          profilePic: profile?.profilePic,
        });
        isNew = true;
      }

      // An earlier profile fetch may have failed (e.g. expired token), so retry it
      if (!isNew && convo.customerName === "Facebook User") {
        const profile = await getFbProfile(psid);
        if (profile?.name) {
          convo.customerName = profile.name;
          if (profile.profilePic) convo.profilePic = profile.profilePic;
        }
      }

      // Skip duplicate events (Meta retries)
      if (msg.mid && convo.lastMid === msg.mid) continue;

      if (!isEcho && event.timestamp) {
        // Temporary: how long Meta took to deliver this webhook. Remove once checked
        // eslint-disable-next-line no-console
        console.log(`FB webhook latency: ${Date.now() - event.timestamp}ms`);
      }

      const now = new Date();
      convo.lastMid = msg.mid;
      convo.lastMessageAt = now;

      if (isEcho) {
        convo.awaitingReplySince = null;
        convo.slaNotified = false;
      } else {
        convo.lastCustomerMessageAt = now;
        convo.unreadCount += 1;
        if (!convo.awaitingReplySince) convo.awaitingReplySince = now;
      }
      await convo.save();

      // Short-lived copy (TTL) so the chat can show this message before Meta's
      // Conversations API returns it. First writer wins: our own reply path may
      // have saved this message already
      if (msg.mid) {
        try {
          await FbRecentMessage.updateOne(
            { mid: msg.mid },
            {
              $setOnInsert: {
                conversation: convo._id,
                direction: isEcho ? "outbound" : "inbound",
                text: msg.text || "",
                attachments: webhookAttachments(msg),
                timestamp: new Date(event.timestamp || Date.now()),
              },
            },
            { upsert: true },
          );
        } catch (err) {
          // A failure here must not block routing and live updates
          // eslint-disable-next-line no-console
          console.error("FB recent message save error:", err);
        }
      }

      if (!isEcho) {
        if (isNew) await routeConversation(convo);
        else await ensureActiveAssignment(convo);
      }

      emitToRooms(CHAT_ROOMS, "fb:message", {
        conversationId: convo._id,
        assignedTo: convo.assignedTo,
        direction: isEcho ? "outbound" : "inbound",
        // Pushed over the socket too, so an open chat shows it immediately
        message: isEcho
          ? undefined
          : {
              id: msg.mid,
              text: msg.text || "",
              direction: "inbound",
              createdAt: new Date(event.timestamp || Date.now()).toISOString(),
              sentByName: null,
              attachments: webhookAttachments(msg),
            },
      });
    }
  }
};

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

const getConversations = async (
  user: JwtPayload,
  query: Record<string, string>,
) => {
  const { tab, ...rest } = query;
  const base: any = {};

  // Everyone sees every conversation. The tabs are only filters
  if (tab === "mine") base.assignedTo = user.userId;
  else if (tab === "unassigned") base.assignedTo = null;

  if (!rest.sort) rest.sort = "-lastMessageAt";

  const queryBuilder = new QueryBuilder(
    FbConversation.find(base).populate("assignedTo", "name picture chatStatus"),
    rest,
  );

  const conversationsData = queryBuilder
    .filter()
    .search(["customerName"])
    .sort()
    .fields()
    .paginate();

  const [data, meta] = await Promise.all([
    conversationsData.build(),
    queryBuilder.getMeta(),
  ]);

  return { data, meta };
};

// Meta's Conversations API holds the history, but it can lag by minutes on new
// messages. So the first page also merges in recent webhook messages (short-lived DB copy)
const getMessages = async (user: JwtPayload, id: string, after?: string) => {
  const convo: any = await getConvo(id);

  const recentPromise: Promise<any[]> = after
    ? Promise.resolve([])
    : (FbRecentMessage.find({ conversation: convo._id })
        .sort({ timestamp: -1 })
        .limit(100)
        .populate("sentBy", "name")
        .lean() as any);

  let metaMessages: any[] = [];
  let nextCursor: string | null = null;
  let metaError: unknown = null;

  try {
    if (!convo.fbThreadId) {
      const threadId = await getFbThreadId(convo.psid);
      if (threadId) {
        convo.fbThreadId = threadId;
        await FbConversation.updateOne(
          { _id: convo._id },
          { fbThreadId: threadId },
        );
      }
    }
    if (convo.fbThreadId) {
      const res = await getFbThreadMessages(convo.fbThreadId, after);
      metaMessages = res.messages;
      nextCursor = res.nextCursor;
    }
  } catch (err) {
    metaError = err;
  }

  const recent = await recentPromise;
  // If Meta failed we can still show recent messages. Throw only when there is nothing to show
  if (metaError && (after || recent.length === 0)) throw metaError;

  // Kon moderator pathalo seta reply log theke
  const logs = await FbReplyLog.find({
    mid: { $in: metaMessages.map((m) => m.id) },
  }).populate("sentBy", "name");
  const senderMap = new Map(
    logs.map((l: any) => [l.mid, l.sentBy?.name as string | undefined]),
  );

  const normalized: any[] = metaMessages.map((m) => ({
    id: m.id,
    text: m.message || "",
    direction: m.from?.id === process.env.FB_PAGE_ID ? "outbound" : "inbound",
    createdAt: m.created_time,
    sentByName: senderMap.get(m.id) || null,
    attachments: (m.attachments?.data || []).map((a: any) => ({
      type: a.mime_type,
      name: a.name,
      url: a.image_data?.url || a.file_url,
    })),
  }));

  const byId = new Map<string, any>(normalized.map((m) => [m.id, m]));
  const near = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 2 * 60 * 1000;

  recent.forEach((r: any) => {
    const createdAt = new Date(r.timestamp).toISOString();
    const sentByName = r.sentBy?.name ?? null;
    const existing = byId.get(r.mid);

    if (existing) {
      // Same message in both: keep Meta's copy, add what only we know
      existing.sentByName = existing.sentByName || sentByName;
      existing.myReaction = r.myReaction ?? null;
      return;
    }

    // Safety net in case Meta uses a different id for the same text message
    const twin = r.text
      ? normalized.find(
          (m) =>
            m.direction === r.direction &&
            m.text === r.text &&
            near(m.createdAt, createdAt),
        )
      : null;
    if (twin) {
      twin.sentByName = twin.sentByName || sentByName;
      return;
    }

    byId.set(r.mid, {
      id: r.mid,
      text: r.text || "",
      direction: r.direction,
      createdAt,
      sentByName,
      myReaction: r.myReaction ?? null,
      attachments: (r.attachments || []).map((a: any) => ({
        type: a.type,
        name: a.name,
        url: a.url,
      })),
    });
  });

  const messages = Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  if (!after && convo.unreadCount) {
    await FbConversation.updateOne({ _id: convo._id }, { unreadCount: 0 });
    convo.unreadCount = 0;
  }

  return { conversation: convo, messages, nextCursor };
};

const claimConversation = async (user: JwtPayload, id: string) => {
  // Atomic: ekshathe duijon claim korle shudhu ekjon pabe
  const claimed = await FbConversation.findOneAndUpdate(
    { _id: id, assignedTo: null },
    {
      assignedTo: user.userId,
      assignedAt: new Date(),
      status: FbConvStatus.OPEN,
      slaNotified: false,
    },
    { new: true },
  );
  if (!claimed) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Conversation already taken by another moderator",
    );
  }

  await FbAssignmentLog.create({
    conversation: claimed._id,
    from: null,
    to: user.userId,
    by: user.userId,
    type: FbAssignType.CLAIM,
  });
  emitToRooms(CHAT_ROOMS, "fb:assignment", {
    conversationId: claimed._id,
    assignedTo: user.userId,
  });
  return claimed;
};

const replyToConversation = async (
  user: JwtPayload,
  id: string,
  text: string,
) => {
  const convo: any = await getConvo(id);

  // No local 24h block: always try to send. Past Meta's 24h window the
  // HUMAN_AGENT tag is used (needs that permission, works up to 7 days)
  const age = Date.now() - (convo.lastCustomerMessageAt?.getTime() || 0);
  const humanAgent = age > DAY;

  let result: { recipient_id: string; message_id: string };
  try {
    result = await sendFbText(convo.psid, text, humanAgent);
  } catch (err: any) {
    if (!humanAgent) throw err;
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      `Facebook rejected this reply. The customer's last message is over 24 hours old, so Facebook needs the HUMAN_AGENT permission (max 7 days). ${err.message}`,
    );
  }
  const now = new Date();

  // A moderator replying to an unassigned chat takes it. Management doesn't.
  // Claim only after the send succeeded, and ignore a lost race
  if (user.role === Role.MODERATOR && !convo.assignedTo) {
    await claimConversation(user, id).catch(() => undefined);
  }

  await FbReplyLog.create({
    conversation: convo._id,
    mid: result.message_id,
    sentBy: user.userId,
  });
  // Short-lived copy so this reply stays in the merged chat even if Meta lags
  await FbRecentMessage.updateOne(
    { mid: result.message_id },
    {
      $set: { sentBy: user.userId },
      $setOnInsert: {
        conversation: convo._id,
        direction: "outbound",
        text,
        attachments: [],
        timestamp: now,
      },
    },
    { upsert: true },
  );
  await FbConversation.updateOne(
    { _id: convo._id },
    { lastMessageAt: now, awaitingReplySince: null, slaNotified: false },
  );

  const assignedTo =
    convo.assignedTo || (user.role === Role.MODERATOR ? user.userId : null);
  emitToRooms(CHAT_ROOMS, "fb:message", {
    conversationId: convo._id,
    assignedTo,
    direction: "outbound",
  });

  return {
    id: result.message_id,
    text,
    direction: "outbound",
    createdAt: now,
  };
};

const reactToMessage = async (
  user: JwtPayload,
  id: string,
  messageId: string,
  reaction: string | null,
) => {
  const convo: any = await getConvo(id);
  await sendFbReaction(convo.psid, messageId, reaction);
  // Remember it while the message is still in the short-lived copy
  await FbRecentMessage.updateOne({ mid: messageId }, { myReaction: reaction });
  return { messageId, reaction };
};

const assignConversation = async (
  user: JwtPayload,
  id: string,
  moderatorId: string | null,
) => {
  const convo = await getConvo(id);
  const target = moderatorId ? await getActiveModerator(moderatorId) : null;

  return assignTo(
    convo,
    target ? target._id : null,
    target ? FbAssignType.MANUAL : FbAssignType.RELEASE,
    user.userId,
  );
};

const transferConversation = async (
  user: JwtPayload,
  id: string,
  toModeratorId: string,
  note?: string,
) => {
  const convo = await getConvo(id);

  if (!isManagement(user.role) && !sameId(convo.assignedTo, user.userId)) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the assigned moderator can transfer this conversation",
    );
  }
  if (sameId(convo.assignedTo, toModeratorId)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Conversation is already with this moderator",
    );
  }

  const target = await getActiveModerator(toModeratorId);
  return assignTo(convo, target._id, FbAssignType.TRANSFER, user.userId, note);
};

const updateStatus = async (
  user: JwtPayload,
  id: string,
  status: "OPEN" | "CLOSED",
) => {
  const convo: any = await getConvo(id);

  convo.status =
    status === "CLOSED"
      ? FbConvStatus.CLOSED
      : convo.assignedTo
        ? FbConvStatus.OPEN
        : FbConvStatus.UNASSIGNED;
  if (status === "CLOSED") {
    convo.awaitingReplySince = null;
    convo.slaNotified = false;
  }
  await convo.save();

  emitToRooms(CHAT_ROOMS, "fb:assignment", {
    conversationId: convo._id,
    assignedTo: convo.assignedTo,
  });
  return convo;
};

// Lead tomar existing Lead module diye create hobe, tarpor ekhane link
const linkLead = async (user: JwtPayload, id: string, leadId: string) => {
  const convo: any = await getConvo(id);
  convo.lead = leadId;
  convo.status = FbConvStatus.CONVERTED;
  convo.awaitingReplySince = null;
  convo.slaNotified = false;
  await convo.save();

  emitToRooms(CHAT_ROOMS, "fb:assignment", {
    conversationId: convo._id,
    assignedTo: convo.assignedTo,
  });
  return convo;
};

const getAssignmentLogs = async (id: string) =>
  FbAssignmentLog.find({ conversation: id })
    .populate("from to by", "name role")
    .sort("-createdAt");

/* ------------------------------------------------------------------ */
/* Moderators, availability, SLA, report                               */
/* ------------------------------------------------------------------ */

const getModerators = async () => {
  const mods = await User.find({
    role: Role.MODERATOR,
    isActive: IsActive.ACTIVE,
    isDeleted: false,
  }).select("name picture chatStatus");

  const counts = await FbConversation.aggregate([
    {
      $match: {
        status: FbConvStatus.OPEN,
        assignedTo: { $in: mods.map((m) => m._id) },
      },
    },
    { $group: { _id: "$assignedTo", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return mods.map((m) => ({
    ...m.toObject(),
    openChats: countMap.get(String(m._id)) || 0,
  }));
};

const setAvailability = async (
  user: JwtPayload,
  chatStatus: "ONLINE" | "OFFLINE",
) => {
  const updated = await User.findByIdAndUpdate(
    user.userId,
    { chatStatus },
    { new: true },
  ).select("name chatStatus");

  // Offline hole open chat gulo onno online moderator-e ba pool-e jabe
  if (chatStatus === "OFFLINE") {
    const convos = await FbConversation.find({
      assignedTo: user.userId,
      status: FbConvStatus.OPEN,
    });
    for (const convo of convos) {
      await routeConversation(convo, {
        exclude: [user.userId],
        note: "Moderator went offline",
      });
    }
  }
  return updated;
};

// Server-e setInterval diye prothi 1 minute-e chalao
const runSlaSweep = async () => {
  const settings: any = await getSettings();
  const now = Date.now();

  const toNotify = await FbConversation.find({
    status: FbConvStatus.OPEN,
    slaNotified: false,
    awaitingReplySince: {
      $ne: null,
      $lte: new Date(now - settings.slaMinutes * 60 * 1000),
    },
  });
  for (const c of toNotify) {
    await FbConversation.updateOne({ _id: c._id }, { slaNotified: true });
    emitToRooms(
      ["management", c.assignedTo ? `user:${c.assignedTo}` : null],
      "fb:sla-breach",
      {
        conversationId: c._id,
        customerName: c.customerName,
        assignedTo: c.assignedTo,
      },
    );
  }

  const overdue = await FbConversation.find({
    status: FbConvStatus.OPEN,
    awaitingReplySince: {
      $ne: null,
      $lte: new Date(now - settings.returnToPoolMinutes * 60 * 1000),
    },
  });
  for (const c of overdue) {
    await routeConversation(c, {
      exclude: c.assignedTo ? [String(c.assignedTo)] : [],
      type: FbAssignType.SLA,
      note: "No reply within SLA",
    });
  }
};

const getReport = async (query: Record<string, string>) => {
  const range: any = {};
  if (query.from) range.$gte = new Date(query.from);
  if (query.to) range.$lte = new Date(query.to);
  const hasRange = Object.keys(range).length > 0;

  const [replies, assigned, converted, mods] = await Promise.all([
    FbReplyLog.aggregate([
      { $match: hasRange ? { createdAt: range } : {} },
      {
        $group: {
          _id: "$sentBy",
          replies: { $sum: 1 },
          conversations: { $addToSet: "$conversation" },
        },
      },
    ]),
    FbAssignmentLog.aggregate([
      {
        $match: {
          to: { $ne: null },
          ...(hasRange ? { createdAt: range } : {}),
        },
      },
      { $group: { _id: "$to", assigned: { $sum: 1 } } },
    ]),
    FbConversation.aggregate([
      {
        $match: {
          status: FbConvStatus.CONVERTED,
          assignedTo: { $ne: null },
          ...(hasRange ? { updatedAt: range } : {}),
        },
      },
      { $group: { _id: "$assignedTo", converted: { $sum: 1 } } },
    ]),
    User.find({ role: Role.MODERATOR, isDeleted: false }).select(
      "name chatStatus",
    ),
  ]);

  const toMap = (arr: any[]) => new Map(arr.map((r) => [String(r._id), r]));
  const r = toMap(replies);
  const a = toMap(assigned);
  const c = toMap(converted);

  return mods.map((m) => ({
    moderatorId: m._id,
    name: m.name,
    chatStatus: (m as any).chatStatus,
    replies: r.get(String(m._id))?.replies || 0,
    conversationsReplied: r.get(String(m._id))?.conversations.length || 0,
    assigned: a.get(String(m._id))?.assigned || 0,
    converted: c.get(String(m._id))?.converted || 0,
  }));
};

export const FacebookServices = {
  isValidSignature,
  handleWebhook,
  getSettings,
  updateSettings,
  getConversations,
  getMessages,
  claimConversation,
  replyToConversation,
  reactToMessage,
  assignConversation,
  transferConversation,
  updateStatus,
  linkLead,
  getAssignmentLogs,
  getModerators,
  setAvailability,
  runSlaSweep,
  getReport,
};