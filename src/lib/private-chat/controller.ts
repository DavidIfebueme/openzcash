import {
  createDeviceIdentity,
  wipeIdentity,
  type DeviceIdentity,
} from "./identity";
import {
  createLiveInvite,
  parseLiveInvite,
  verifyLiveInvite,
  type LiveInvite,
} from "./live-invite";
import { safetyCode } from "./invite";
import { encodeKey } from "./keys";
import { messageId } from "./messages";
import { readPacket, type ChatPacket } from "./protocol";
import { ConversationRatchet, type RatchetBundle } from "./ratchet";
import { openEnvelopeFromHeader, sealEnvelope } from "./envelope";
import { normalizeAlias } from "./session";
import {
  createNymTransport,
  type NymTransport,
  type TransportEvent,
} from "./transport";
import {
  openPresence,
  presenceCommand,
  type PresenceService,
  PRESENCE_HEARTBEAT_MS,
} from "./presence";

import { NymDirectory } from "./nym-directory";
import { DIRECTORY_RESPONSE, type DirectoryConfig } from "./directory-wire";
import { openRoom, type DiscoveryRoom } from "./discovery-room";

export const ROUTE_CHECK_INTERVAL_MS = 30_000;
export const ROUTE_CHECK_TIMEOUT_MS = 60_000;
export const ACK_TIMEOUT_MS = 60_000;
export const MAX_CONVERSATIONS = 8;
const RETRY_DELAYS = [2000, 5000, 10_000];
export type ChatLine = {
  id: string;
  direction: "in" | "out";
  body: string;
  at: number;
  delivery: "sending" | "waiting" | "delivered" | "unconfirmed";
  deadline?: number;
};
type RequestPacket = Extract<ChatPacket, { t: "request" }>;
export type ChatRequest = {
  packet: RequestPacket;
  publicKey: string;
  code: string;
};
export type Contact = {
  alias: string;
  publicKey: string;
  address: string;
  code: string;
  conversation: string;
  status: "requesting" | "active" | "ended";
  role: "inviter" | "requester";
  ready: boolean;
  remoteSequence: number;
  acceptedUntil?: number;
  requestSequence?: number;
  request?: RequestPacket;
};
export type ConversationSummary = {
  id: string;
  alias: string;
  status: Contact["status"];
  ready: boolean;
  unread: number;
  lastMessage: string | null;
};
type ConversationState = {
  contact: Contact;
  lines: ChatLine[];
  note: string;
  sending: boolean;
  unread: number;
  probe: { id: string; deadline: number } | null;
  seen: Map<string, string>;
  ratchet: { engine: ConversationRatchet; peer: RatchetBundle | null } | null;
};
export type ChatSnapshot = {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  canStartConversation: boolean;
  alias: string | null;
  keyReady: boolean;
  busy: boolean;
  link:
    | "disconnected"
    | "checking"
    | "connecting"
    | "connected"
    | "failed"
    | "reconnecting"
    | "offline";
  connectionWanted: boolean;
  retry: number;
  invite: LiveInvite | null;
  requests: ChatRequest[];
  contact: Contact | null;
  lines: ChatLine[];
  availableUntil: number | null;
  presence: "off" | "publishing" | "online" | "error";
  room: { id: string; token: string } | null;
  peers: LiveInvite[];
  directory: "idle" | "loading" | "ready" | "error";
  note: string;
  sending: boolean;
  now: number;
};
const initial = (): ChatSnapshot => ({
  conversations: [],
  activeConversationId: null,
  canStartConversation: true,
  alias: null,
  keyReady: false,
  busy: false,
  link: "disconnected",
  connectionWanted: false,
  retry: 0,
  invite: null,
  requests: [],
  contact: null,
  lines: [],
  availableUntil: null,
  presence: "off",
  room: null,
  peers: [],
  directory: "idle",
  note: "",
  sending: false,
  now: 0,
});

export class ChatController {
  private state = initial();
  private listeners = new Set<() => void>();
  private identity: DeviceIdentity | null = null;
  private credentials: { clientId: string; storagePassphrase: string } | null =
    null;
  private transport: NymTransport | null = null;
  private address: string | null = null;
  private epoch = 0;
  private connection = 0;
  private sequence = 0;
  private revision = 0;
  private wanted = false;
  private networkOnline = true;
  private retryAt = 0;
  private routeProbe: { id: string; deadline: number } | null = null;
  private nextRouteCheck = 0;
  private room: DiscoveryRoom | null = null;
  private roomIdentity: DeviceIdentity | null = null;
  private roomEpoch = 0;
  private inviteEpoch = 0;
  private conversations = new Map<string, ConversationState>();
  private activeConversationId: string | null = null;
  private conversationVisible = true;
  private globalNote = "";
  private receiveChain: Promise<void> = Promise.resolve();
  private refused = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private discover = false;
  private nextList = 0;
  private peerLeases = new Map<string, number>();
  private listing = 0;
  private listVersion = 0;
  private receiving = 0;
  private nymDirectory: NymDirectory | null = null;
  private directory: PresenceService;
  private nextHeartbeat = 0;
  private publishing = false;
  private presenceEpoch = 0;
  private accepting = false;
  private conversationEpoch = 0;
  private preparing = false;
  private current(id = this.activeConversationId) {
    return id ? this.conversations.get(id) : undefined;
  }
  private hasPeer(publicKey: string) {
    return [...this.conversations.values()].some(c =>
      c.contact.publicKey === publicKey && c.contact.status !== "ended");
  }
  private isCurrent(conversation: ConversationState) {
    return this.current(conversation.contact.conversation) === conversation;
  }
  private clearRatchet(conversation: ConversationState) {
    conversation.ratchet?.engine.close();
    conversation.ratchet = null;
    conversation.probe = null;
    conversation.sending = false;
  }
  private updateConversation(conversation: ConversationState, patch: Partial<ConversationState>) {
    if (!this.isCurrent(conversation)) return;
    Object.assign(conversation, patch);
    this.patch({});
  }
  private addConversation(contact: Contact, engine: ConversationRatchet, peer: RatchetBundle | null, note: string) {
    const conversation: ConversationState = {
      contact, lines: [], note, sending: false, unread: 0,
      probe: null, seen: new Map(), ratchet: { engine, peer },
    };
    this.conversations.set(contact.conversation, conversation);
    this.activeConversationId = contact.conversation;
    this.patch({ note: "" });
    return conversation;
  }
  private removeConversation(conversation: ConversationState, note = "") {
    this.clearRatchet(conversation);
    this.conversations.delete(conversation.contact.conversation);
    const selected = this.activeConversationId === conversation.contact.conversation;
    if (selected) this.activeConversationId = null;
    this.patch(selected ? { note } : {});
  }
  selectConversation(id: string | null) {
    if (id !== null && !this.conversations.has(id)) return;
    this.activeConversationId = id;
    const conversation = this.current();
    if (conversation && this.conversationVisible) conversation.unread = 0;
    this.patch({ note: "" });
  }
  setConversationVisible(visible: boolean) {
    this.conversationVisible = visible;
    const conversation = this.current();
    if (visible && conversation?.unread) {
      conversation.unread = 0;
      this.patch({});
    }
  }
  private invitationWork: Promise<LiveInvite | null> | null = null;

  constructor(
    private factory = createNymTransport,
    directory?: PresenceService,
    private clock = Date.now,
    config: DirectoryConfig | null = null,
  ) {
    this.nymDirectory = directory
      ? null
      : new NymDirectory(
          config,
          (input) => {
            if (
              !this.transport ||
              this.state.link !== "connected" ||
              !this.wanted
            )
              throw new Error("Discover requires Nym");
            this.transport.send(input);
          },
          () =>
            !!this.transport && this.state.link === "connected" && this.wanted,
          () => this.address,
          (roomId) =>
            this.room?.id === roomId ? this.room.authSecret : null,
        );
    this.directory = directory ?? this.nymDirectory!;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(patch: Partial<ChatSnapshot>) {
    if (patch.note !== undefined) this.globalNote = patch.note;
    const active = this.current();
    this.state = {
      ...this.state, ...patch,
      conversations: [...this.conversations.values()].map(({ contact, lines, unread }) => ({
        id: contact.conversation, alias: contact.alias, status: contact.status,
        ready: contact.ready, unread, lastMessage: lines.at(-1)?.body ?? null,
      })),
      activeConversationId: this.activeConversationId,
      canStartConversation: this.conversations.size < MAX_CONVERSATIONS,
      contact: active?.contact ?? null,
      lines: active?.lines ?? [],
      sending: active?.sending ?? false,
      note: this.globalNote || active?.note || "",
    };
    this.listeners.forEach((listener) => listener());
  }
  start() {
    this.tick();
    if (!this.timer) this.timer = setInterval(() => this.tick(), 1000);
  }
  dispose() {
    this.leave();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  setNote(note: string) {
    this.patch({ note });
  }

  async enter(value: string) {
    const alias = normalizeAlias(value);
    if (!alias) {
      this.patch({
        note: "Use 2–24 letters, numbers, spaces, dots, hyphens or underscores.",
      });
      return false;
    }
    if (this.state.busy) return false;
    const epoch = this.epoch;
    this.patch({ busy: true, note: "" });
    try {
      if (!this.identity) {
        const created = await createDeviceIdentity();
        if (epoch !== this.epoch) {
          wipeIdentity(created);
          return false;
        }
        this.identity = created;
        this.credentials = {
          clientId: `ozchat-${messageId()}`,
          storagePassphrase: encodeKey(
            crypto.getRandomValues(new Uint8Array(32)),
          ),
        };
      }
      this.setAvailable(false);
      this.patch({
        alias,
        keyReady: true,
        invite: null,
        requests: [],
        busy: false,
      });
      return true;
    } catch {
      if (epoch === this.epoch)
        this.patch({
          busy: false,
          note: "Could not prepare this session. Try again.",
        });
      return false;
    }
  }

  connect = () => {
    if (
      !this.identity ||
      !this.credentials ||
      ["connecting", "checking", "connected"].includes(this.state.link)
    )
      return;
    this.wanted = true;
    this.patch({ connectionWanted: true });
    this.retryAt = 0;
    if (!this.networkOnline) {
      this.patch({
        link: "offline",
        note: "Waiting for your internet connection.",
      });
      return;
    }
    const ticket = ++this.connection;
    this.transport?.disconnect();
    this.patch({ link: "connecting", note: "", sending: false });
    const created = this.factory((event) => {
      if (ticket !== this.connection) return;
      this.handleTransport(event, ticket);
    });
    this.transport = created;
    try {
      created.connect(this.credentials);
    } catch {
      this.handleTransport(
        { type: "status", status: "failed", reason: "worker-error" },
        ticket,
      );
    }
  };
  reconnect = () => {
    this.patch({ retry: 0 });
    this.connect();
  };
  disconnect = () => {
    this.wanted = false;
    this.patch({ connectionWanted: false });
    this.stopConnection();
    this.patch({
      link: "disconnected",
      retry: 0,
      note: this.conversations.size
        ? "Conversations kept in this tab. Reconnect when you’re ready."
        : "Disconnected.",
    });
  };
  private stopConnection() {
    this.setAvailable(false);
    this.connection += 1;
    this.nymDirectory?.close();
    this.listVersion++;
    this.listing = 0;
    this.peerLeases.clear();
    this.transport?.disconnect();
    this.transport = null;
    this.address = null;
    this.retryAt = 0;
    for (const conversation of this.conversations.values()) {
      conversation.probe = null;
      conversation.sending = false;
      conversation.contact = { ...conversation.contact, ready: false };
      conversation.lines = conversation.lines.map(line =>
        line.direction === "out" && line.delivery !== "delivered"
          ? { ...line, delivery: "unconfirmed" } : line);
    }
    this.routeProbe = null;
    this.nextRouteCheck = 0;
    this.patch({
      peers: [],
      directory: "idle",
      invite: null,
      requests: [],
    });
  }
  network(online: boolean) {
    this.networkOnline = online;
    if (!online) {
      const wanted = this.wanted;
      this.stopConnection();
      this.wanted = wanted;
      this.patch({
        link: "offline",
        note: "You’re offline. Your conversations stay in this tab.",
      });
    } else if (this.wanted) {
      this.patch({ retry: 0 });
      this.connect();
    } else if (this.state.link === "offline")
      this.patch({ link: "disconnected", note: "" });
  }
  leave = () => {
    this.epoch += 1;
    this.disconnect();
    this.leaveRoom();
    for (const conversation of this.conversations.values()) this.clearRatchet(conversation);
    this.conversations.clear();
    this.activeConversationId = null;
    this.conversationEpoch++;
    this.preparing = false;
    wipeIdentity(this.identity);
    this.identity = null;
    this.credentials = null;
    this.sequence = 0;
    this.refused.clear();
    this.accepting = false;
    this.invitationWork = null;
    this.patch(initial());
  };

  private handleTransport(event: TransportEvent, ticket: number) {
    if (event.type === "bytes") {
      if (this.receiving >= 32) return;
      this.receiving++;
      this.receiveChain = this.receiveChain
        .then(() =>
          ticket === this.connection
            ? event.bytes[0] === DIRECTORY_RESPONSE
              ? this.nymDirectory?.receive(event.bytes)
              : this.receive(event.bytes, ticket)
            : undefined,
        )
        .catch(() => undefined)
        .finally(() => {
          this.receiving--;
        });
    } else if (event.type === "submitted" || event.type === "submit-failed") {
      if (event.type === "submit-failed") this.nymDirectory?.fail(event.id);
      for (const conversation of this.conversations.values()) {
        if (!conversation.lines.some(line => line.id === event.id)) continue;
        this.updateConversation(conversation, {
          lines: conversation.lines.map(line =>
            line.id === event.id && line.delivery !== "delivered"
              ? { ...line, delivery: event.type === "submitted" ? "waiting" : "unconfirmed" }
              : line),
        });
      }
    } else if (event.status === "connected" && event.address) {
      this.address = event.address;
      this.sequence += 1;
      this.patch({
        link: "checking",
        note: "Verifying a round trip through Nym…",
      });
      this.checkRoute();
    } else if (event.status === "connecting") {
      this.patch({ link: "connecting" });
    } else {
      this.stopConnection();
      if (
        this.wanted &&
        this.networkOnline &&
        this.state.retry < RETRY_DELAYS.length
      ) {
        this.retryAt = this.clock() + RETRY_DELAYS[this.state.retry];
        this.patch({
          link: "reconnecting",
          retry: this.state.retry + 1,
          note: "Connection interrupted. Reconnecting through Nym…",
        });
      } else {
        this.wanted = false;
        this.patch({
          link: "failed",
          connectionWanted: false,
          note: event.reason === "gateway-unavailable"
            ? "The configured Nym gateway is unavailable. Please try again later."
            : "Could not connect through Nym. Try again in a moment.",
        });
      }
    }
  }
  private async sendPacket(
    publicKey: string,
    address: string,
    packet: ChatPacket,
  ) {
    const identity = this.identity,
      transport = this.transport,
      ticket = this.connection,
      epoch = this.epoch;
    if (
      !identity ||
      !transport ||
      (this.state.link !== "connected" &&
        !(packet.t === "probe" && this.state.link === "checking"))
    )
      return false;
    const conversation = this.current("c" in packet ? packet.c
      : packet.t === "request" ? packet.id
      : packet.t === "accept" || packet.t === "reject" ? packet.ref : null);
    const ratchet = conversation?.ratchet;
    let wire = packet;
    if ("c" in packet) {
      if (packet.t === "ratchet" || !ratchet ||
          conversation?.contact.publicKey !== publicKey) return false;
      const content = await ratchet.engine.encrypt(JSON.stringify(packet));
      if (!content || (packet.t !== "bye" &&
        (!conversation || !this.isCurrent(conversation) || ratchet !== conversation.ratchet))) return false;
      wire = { v: 3, t: "ratchet", id: packet.id, c: packet.c, content };
    }
    const bytes = await sealEnvelope({
      senderSecretKey: identity.secretKey,
      senderPublicKey: identity.publicKey,
      recipientPublicKey: publicKey,
      plaintext: wire,
    });
    if (
      !bytes ||
      epoch !== this.epoch ||
      ticket !== this.connection ||
      transport !== this.transport
    )
      return false;
    // Encryption is asynchronous. Recheck consent and the intended peer
    // immediately before queuing a packet after a state change.
    const contact = conversation && this.isCurrent(conversation) ? conversation.contact : null;
    if (
      "c" in packet &&
      packet.t !== "bye" &&
      (contact?.conversation !== packet.c ||
        contact.publicKey !== publicKey ||
        contact.status !== "active")
    )
      return false;
    if (
      packet.t === "request" &&
      (contact?.conversation !== packet.id ||
        contact.publicKey !== publicKey ||
        contact.status !== "requesting" ||
        contact.request?.sequence !== packet.sequence ||
        contact.request.address !== packet.address)
    )
      return false;
    if (
      packet.t === "accept" &&
      (contact?.conversation !== packet.ref ||
        contact.publicKey !== publicKey ||
        contact.address !== address ||
        contact.status !== "active")
    )
      return false;
    if (
      packet.t === "reject" &&
      (!this.refused.has(publicKey) || contact?.conversation === packet.ref)
    )
      return false;
    try {
      transport.send({ id: packet.id, recipient: address, bytes });
      return true;
    } catch {
      return false;
    }
  }

  makeInvite(): Promise<LiveInvite | null> {
    if (this.invitationWork) return this.invitationWork;
    const work = this.prepareInvite();
    this.invitationWork = work;
    void work
      .finally(() => {
        if (this.invitationWork === work) this.invitationWork = null;
      })
      .catch(() => undefined);
    return work;
  }
  private async prepareInvite() {
    const identity = this.identity,
      address = this.address,
      alias = this.state.alias,
      ticket = this.connection,
      generation = this.inviteEpoch;
    if (
      !identity ||
      !address ||
      !alias ||
      this.state.link !== "connected" ||
      !this.state.canStartConversation
    )
      return null;
    if (this.state.invite && this.state.invite.expiresAt > this.clock())
      return this.state.invite;
    const invite = await createLiveInvite(
      identity,
      alias,
      address,
      this.clock(),
    );
    if (
      ticket !== this.connection ||
      identity !== this.identity ||
      generation !== this.inviteEpoch ||
      !this.state.canStartConversation
    )
      return null;
    this.patch({ invite, note: "", requests: [] });
    this.refused.clear();
    return invite;
  }
  revokeInvite = () => {
    this.setAvailable(false);
    this.patch({ invite: null, requests: [], note: "Invite revoked." });
  };
  async requestChat(value: string) {
    if (
      !this.identity ||
      !this.address ||
      this.state.link !== "connected" ||
      !this.state.canStartConversation || this.preparing || this.accepting
    )
      return false;
    const ticket = this.connection,
      identity = this.identity;
    const invite = parseLiveInvite(value);
    const valid = invite && (await verifyLiveInvite(invite, this.clock()));
    if (ticket !== this.connection || identity !== this.identity) return false;
    if (!invite || !valid) {
      this.patch({
        note: "This invite is invalid or expired. Ask for a new one.",
      });
      return false;
    }
    if (invite.publicKey === identity.publicKey) {
      this.patch({ note: "That invite belongs to this tab." });
      return false;
    }
    if (this.hasPeer(invite.publicKey)) {
      this.patch({ note: "A conversation with this person is already open. Choose it from Chats." });
      return false;
    }
    const code = await safetyCode(identity.publicKey, invite.publicKey);
    if (
      !code ||
      ticket !== this.connection ||
      identity !== this.identity ||
      !this.state.canStartConversation || this.hasPeer(invite.publicKey) || this.preparing || this.accepting ||
      !this.address
    )
      return false;
    const generation = ++this.conversationEpoch;
    const conversation = messageId();
    this.preparing = true;
    let engine: ConversationRatchet;
    try {
      engine = await ConversationRatchet.create(conversation, identity.publicKey, invite.publicKey);
    } catch {
      if (generation === this.conversationEpoch) {
        this.preparing = false;
        this.patch({ note: "Could not prepare encryption. Try again." });
      }
      return false;
    }
    if (generation !== this.conversationEpoch || ticket !== this.connection ||
        identity !== this.identity || !this.state.canStartConversation || this.hasPeer(invite.publicKey) || !this.address ||
        invite.expiresAt <= this.clock()) {
      engine.close();
      if (generation === this.conversationEpoch) this.preparing = false;
      return false;
    }
    this.preparing = false;
    const request: RequestPacket = {
      v: 3,
      t: "request",
      id: conversation,
      ratchet: engine.bundle,
      inviteId: invite.id,
      expiresAt: invite.expiresAt,
      alias: this.state.alias!,
      address: this.address,
      sequence: this.sequence,
    };
    this.revokeInvite();
    this.addConversation({
        alias: invite.alias,
        publicKey: invite.publicKey,
        address: invite.address,
        code,
        conversation: request.id,
        status: "requesting",
        role: "requester",
        ready: false,
        remoteSequence: 0,
        request,
      }, engine, null, "Waiting for the other person to accept.");
    await this.sendPacket(invite.publicKey, invite.address, request);
    return true;
  }
  async retryRequest(id = this.activeConversationId) {
    const conversation = this.current(id);
    const contact = conversation?.contact;
    if (
      !conversation || contact?.status !== "requesting" ||
      !contact.request ||
      contact.request.expiresAt <= this.clock() ||
      !this.address ||
      this.state.link !== "connected"
    ) return;
    // A Nym reconnection can change the return address. Keep the original
    // request ID and advance its route sequence so older copies cannot replace it.
    const request: RequestPacket = {
      ...contact.request,
      address: this.address,
      sequence: this.sequence,
    };
    this.updateConversation(conversation, { contact: { ...contact, request } });
    const sent = await this.sendPacket(contact.publicKey, contact.address, request);
    if (this.isCurrent(conversation) && conversation.contact.status === "requesting") {
      this.updateConversation(conversation, { note: sent
        ? "Request sent again. Waiting for acceptance."
        : "Could not resend the request. Try again while connected." });
    }
  }
  async acceptRequest(id: string) {
    if (this.accepting || this.preparing || !this.state.canStartConversation || this.state.link !== "connected")
      return;
    const item = this.state.requests.find((item) => item.packet.id === id);
    const invite = this.state.invite;
    if (
      !item ||
      this.hasPeer(item.publicKey) || this.conversations.has(id) ||
      !invite ||
      invite.expiresAt <= this.clock() ||
      item.packet.inviteId !== invite.id ||
      !this.address
    )
      return;
    this.accepting = true;
    const generation = ++this.conversationEpoch;
    const ticket = this.connection;
    const identity = this.identity!;
    let engine: ConversationRatchet | null = null;
    try {
      engine = await ConversationRatchet.create(item.packet.id, identity.publicKey, item.publicKey);
      await engine.setPeer(item.packet.ratchet, false);
    } catch {
      engine?.close();
      if (generation === this.conversationEpoch) {
        this.accepting = false;
        this.patch({ note: "Could not prepare encryption. Request a new invite." });
      }
      return;
    }
    if (generation !== this.conversationEpoch || ticket !== this.connection ||
        identity !== this.identity || this.state.invite !== invite ||
        !this.state.requests.includes(item) || this.refused.has(item.publicKey) ||
        invite.expiresAt <= this.clock() || !this.state.canStartConversation ||
        this.hasPeer(item.publicKey) || this.conversations.has(id) || !this.address) {
      engine.close();
      if (generation === this.conversationEpoch) this.accepting = false;
      return;
    }
    this.setAvailable(false);
    const contact: Contact = {
      alias: item.packet.alias,
      publicKey: item.publicKey,
      address: item.packet.address,
      code: item.code,
      conversation: item.packet.id,
      status: "active",
      role: "inviter",
      ready: false,
      remoteSequence: 0,
      acceptedUntil: item.packet.expiresAt,
      requestSequence: item.packet.sequence,
    };
    this.addConversation(contact, engine, item.packet.ratchet, "Accepted. Confirming the connection…");
    this.patch({ invite: null, requests: [] });
    await this.sendPacket(contact.publicKey, contact.address, {
      v: 3,
      t: "accept",
      ratchet: engine.bundle,
      id: messageId(),
      ref: contact.conversation,
      address: this.address,
    });
    if (generation === this.conversationEpoch) this.accepting = false;
  }
  async rejectRequest(id: string) {
    const item = this.state.requests.find((item) => item.packet.id === id);
    if (!item) return;
    this.refused.add(item.publicKey);
    this.patch({
      requests: this.state.requests.filter((item) => item.packet.id !== id),
    });
    await this.sendPacket(item.publicKey, item.packet.address, {
      v: 3,
      t: "reject",
      id: messageId(),
      ref: id,
    });
  }
  endConversation = (id = this.activeConversationId) => {
    const conversation = this.current(id);
    if (!conversation) {
      if (id !== null) return;
      this.conversationEpoch++;
      this.preparing = false;
      this.accepting = false;
      return;
    }
    const { contact, ratchet } = conversation;
    // Capture this engine for the final authenticated control; removing the
    // context immediately cancels its other queued work, never another chat's.
    const ending = contact.status === "active"
      ? this.sendPacket(contact.publicKey, contact.address, {
          v: 3, t: "bye", id: messageId(), c: contact.conversation,
        })
      : Promise.resolve(false);
    conversation.ratchet = null;
    this.removeConversation(conversation);
    void ending.finally(() => ratchet?.engine.close());
  };

  private async receive(bytes: Uint8Array, ticket: number) {
    const identity = this.identity;
    if (!identity || !["checking", "connected"].includes(this.state.link))
      return;
    const opened = await openEnvelopeFromHeader({
      bytes,
      recipientSecretKey: identity.secretKey,
    });
    if (
      ticket !== this.connection ||
      identity !== this.identity ||
      !opened ||
      opened.plaintext.v !== 3
    )
      return;
    let p: ChatPacket = opened.plaintext;
    const key = opened.senderPublicKey;
    if (p.t === "ratchet") {
      const conversation = this.current(p.c);
      const ratchet = conversation?.ratchet;
      if (!conversation || !ratchet || conversation.contact.publicKey !== key ||
          conversation.contact.status !== "active") return;
      const plain = await ratchet.engine.decrypt(p.content);
      if (!plain || !this.isCurrent(conversation) || ratchet !== conversation.ratchet ||
          ticket !== this.connection) return;
      let inner: ChatPacket | null;
      try { inner = readPacket(JSON.parse(plain)); } catch { return; }
      if (!inner || !("c" in inner) || inner.t === "ratchet" ||
          inner.c !== p.c || inner.id !== p.id) return;
      p = inner;
    } else if ("c" in p) return; // Never accept conversation data under the static key alone.
    if (key === identity.publicKey) {
      if (
        p.t !== "probe" ||
        p.id !== this.routeProbe?.id ||
        this.routeProbe.deadline <= this.clock()
      )
        return;
      this.routeProbe = null;
      this.nextRouteCheck = this.clock() + ROUTE_CHECK_INTERVAL_MS;
      const wasChecking = this.state.link === "checking";
      this.patch({
        link: "connected",
        retry: 0,
        ...(wasChecking ? { note: "" } : {}),
      });
      if (wasChecking && this.discover) void this.loadDirectory();
      if (wasChecking) for (const conversation of this.conversations.values()) {
        if (conversation.contact.status === "active") void this.restorePeerAfterReconnect(conversation);
        if (conversation.contact.status === "requesting") void this.retryRequest(conversation.contact.conversation);
      }
      return;
    }
    if (this.state.link !== "connected" || p.t === "probe") return;
    const conversation = this.current("c" in p ? p.c : p.t === "request" ? p.id : p.ref);
    let contact = conversation?.contact;
    if (p.t === "request") {
      if (
        conversation && contact?.publicKey === key &&
        contact.conversation === p.id &&
        contact.status === "active" &&
        contact.role === "inviter" &&
        contact.acceptedUntil === p.expiresAt &&
        p.expiresAt > this.clock() &&
        this.address
      ) {
        const previous = Math.max(contact.requestSequence ?? 0, contact.remoteSequence);
        if (!conversation.ratchet || JSON.stringify(p.ratchet) !== JSON.stringify(conversation.ratchet.peer)) return;
        if (p.sequence < previous ||
            (p.sequence === previous && p.address !== contact.address)) return;
        if (p.sequence > previous) {
          contact = { ...contact, address: p.address,
            requestSequence: p.sequence, ready: false };
          this.updateConversation(conversation, { contact });
        }
        await this.sendPacket(key, contact.address, {
          v: 3,
          t: "accept",
          ratchet: conversation.ratchet.engine.bundle,
          id: messageId(),
          ref: p.id,
          address: this.address,
        });
        return;
      }
      const invite = this.state.invite;
      if (
        !this.state.canStartConversation || this.hasPeer(key) || this.conversations.has(p.id) ||
        !invite ||
        invite.id !== p.inviteId ||
        invite.expiresAt !== p.expiresAt ||
        p.expiresAt <= this.clock() ||
        this.refused.has(key)
      ) return;
      const pending = this.state.requests.find((item) => item.publicKey === key);
      if (pending) {
        if (JSON.stringify(pending.packet.ratchet) !== JSON.stringify(p.ratchet) ||
            pending.packet.id !== p.id ||
            pending.packet.sequence > p.sequence ||
            (pending.packet.sequence === p.sequence &&
              pending.packet.address !== p.address)) return;
        if (p.sequence > pending.packet.sequence)
          this.patch({ requests: this.state.requests.map((item) =>
            item === pending ? { ...item, packet: p } : item) });
        return;
      }
      if (this.state.requests.length >= 5) return;
      const code = await safetyCode(identity.publicKey, key);
      if (
        !code ||
        ticket !== this.connection ||
        this.state.invite !== invite ||
        invite.expiresAt <= this.clock() ||
        !this.state.canStartConversation || this.hasPeer(key) || this.conversations.has(p.id)
      )
        return;
      this.patch({
        requests: [...this.state.requests, { packet: p, publicKey: key, code }],
      });
      return;
    }
    if (!conversation || !contact || contact.publicKey !== key || contact.status === "ended")
      return;
    if (
      p.t === "accept" &&
      p.ref === contact.conversation &&
      contact.status === "requesting" &&
      contact.request &&
      contact.request.expiresAt > this.clock()
    ) {
      const ratchet = conversation.ratchet;
      if (!ratchet) return;
      try { await ratchet.engine.setPeer(p.ratchet, true); }
      catch {
        if (ratchet === conversation.ratchet) this.updateConversation(conversation, { note: "Encryption handshake failed. Start a new conversation." });
        return;
      }
      if (!this.isCurrent(conversation) || ratchet !== conversation.ratchet || ticket !== this.connection ||
          conversation.contact !== contact || contact.request.expiresAt <= this.clock()) return;
      ratchet.peer = p.ratchet;
      this.updateConversation(conversation, {
        contact: {
          ...contact,
          status: "active",
          address: p.address,
          request: undefined,
        },
        note: "Accepted. Confirming the connection…",
      });
      await this.checkPeer(contact.conversation);
      return;
    }
    if (
      p.t === "reject" &&
      p.ref === contact.conversation &&
      contact.status === "requesting"
    ) {
      this.removeConversation(conversation, "The chat request was declined.");
      return;
    }
    if (!("c" in p) || p.c !== contact.conversation) return;
    if (p.t === "bye") {
      this.clearRatchet(conversation);
      this.updateConversation(conversation, {
        contact: { ...contact, status: "ended", ready: false },
        note: "The other person ended this conversation.",
      });
      return;
    }
    if (contact.status !== "active") return;
    if (p.t === "resume" || p.t === "ready") {
      if (
        p.sequence < contact.remoteSequence ||
        (contact.role === "inviter" &&
          p.sequence < (contact.requestSequence ?? 0)) ||
        (p.sequence === contact.remoteSequence && p.address !== contact.address)
      )
        return;
      if (
        p.t === "ready" &&
        (p.ref !== conversation.probe?.id || conversation.probe.deadline <= this.clock())
      )
        return;
      const resumed = p.sequence > contact.remoteSequence;
      contact = {
        ...contact,
        address: p.address,
        remoteSequence: p.sequence,
        ready: p.t === "ready" || (contact.ready && !resumed),
      };
      this.updateConversation(conversation, { contact, ...(contact.ready ? { note: "" } : {}) });
      if (p.t === "ready") conversation.probe = null;
      else if (this.address) {
        await this.sendPacket(key, p.address, {
          v: 3,
          t: "ready",
          id: messageId(),
          c: p.c,
          ref: p.id,
          address: this.address,
          sequence: this.sequence,
        });
        // A fresh peer route must also answer our challenge. Reuse an existing
        // probe on the new route so a lost pre-reconnect probe cannot strand us.
        if (resumed && conversation.probe) {
          await this.sendPacket(key, p.address, {
            v: 3,
            t: "resume",
            id: conversation.probe.id,
            c: p.c,
            address: this.address,
            sequence: this.sequence,
          });
        } else if (!contact.ready && !conversation.probe) await this.checkPeer(contact.conversation);
      }
      return;
    }
    if (p.t === "ack") {
      this.updateConversation(conversation, {
        lines: conversation.lines.map((line) =>
          line.direction === "out" && line.id === p.ref
            ? { ...line, delivery: "delivered" }
            : line,
        ),
      });
      return;
    }
    if (p.t !== "text") return;
    const known = conversation.seen.get(p.id);
    if (known !== undefined && known !== p.body) return;
    if (known === undefined) {
      if (conversation.lines.length >= 200) {
        this.updateConversation(conversation, {
          note: "This conversation has reached 200 messages. Start a new conversation.",
        });
        return;
      }
      conversation.seen.set(p.id, p.body);
      this.updateConversation(conversation, {
        unread: conversation.unread + (this.activeConversationId === contact.conversation && this.conversationVisible ? 0 : 1),
        lines: [
          ...conversation.lines,
          {
            id: p.id,
            direction: "in",
            body: p.body,
            at: this.clock(),
            delivery: "delivered",
          },
        ],
      });
    }
    // Re-ack a retry without displaying it twice, including after a lost ack.
    await this.sendPacket(key, contact.address, {
      v: 3,
      t: "ack",
      id: messageId(),
      c: contact.conversation,
      ref: p.id,
    });
  }

  private checkRoute() {
    if (
      !this.identity ||
      !this.address ||
      this.routeProbe ||
      !["checking", "connected"].includes(this.state.link)
    )
      return;
    const id = messageId(),
      ticket = this.connection;
    this.routeProbe = { id, deadline: this.clock() + ROUTE_CHECK_TIMEOUT_MS };
    const failed = () => {
      if (ticket === this.connection && this.routeProbe?.id === id)
        this.handleTransport(
          { type: "status", status: "failed", reason: "timeout" },
          ticket,
        );
    };
    void this.sendPacket(this.identity.publicKey, this.address, {
      v: 3,
      t: "probe",
      id,
    })
      .then((sent) => {
        if (!sent) failed();
      })
      .catch(failed);
  }

  private async restorePeerAfterReconnect(conversation: ConversationState) {
    const contact = conversation.contact;
    if (
      this.isCurrent(conversation) && conversation.ratchet && contact.status === "active" &&
      contact.role === "inviter" &&
      contact.remoteSequence === 0 &&
      contact.acceptedUntil &&
      contact.acceptedUntil > this.clock() &&
      this.address
    ) {
      // The original acceptance may have been lost. The requester ignores
      // resume until it receives an authenticated acceptance for its request.
      await this.sendPacket(contact.publicKey, contact.address, {
        v: 3,
        t: "accept",
          ratchet: conversation.ratchet.engine.bundle,
        id: messageId(),
        ref: contact.conversation,
        address: this.address,
      });
    }
    await this.checkPeer(contact.conversation);
  }

  async checkPeer(conversationId = this.activeConversationId) {
    const conversation = this.current(conversationId);
    const contact = conversation?.contact;
    if (
      !conversation || !contact ||
      contact.status !== "active" ||
      !this.address ||
      this.state.link !== "connected"
    )
      return;
    const id = messageId();
    conversation.probe = { id, deadline: this.clock() + ACK_TIMEOUT_MS };
    this.updateConversation(conversation, {
      contact: { ...contact, ready: false },
      note: "Checking the other person’s connection…",
    });
    await this.sendPacket(contact.publicKey, contact.address, {
      v: 3,
      t: "resume",
      id,
      c: contact.conversation,
      address: this.address,
      sequence: this.sequence,
    });
  }
  async send(body: string, retryId?: string) {
    const conversation = this.current();
    const contact = conversation?.contact;
    const trimmed = body.trim();
    if (
      !conversation || !contact ||
      contact.status !== "active" ||
      !contact.ready ||
      this.state.link !== "connected" ||
      conversation.sending ||
      !trimmed ||
      trimmed.length > 400 ||
      (!retryId && conversation.lines.length >= 200)
    )
      return false;
    const existing = retryId
      ? conversation.lines.find(
          (line) =>
            line.id === retryId &&
            line.direction === "out" &&
            line.delivery === "unconfirmed",
        )
      : null;
    if (retryId && !existing) return false;
    const id = retryId || messageId(),
      ticket = this.connection;
    const line: ChatLine = {
      id,
      direction: "out",
      body: existing?.body ?? trimmed,
      at: existing?.at ?? this.clock(),
      deadline: this.clock() + ACK_TIMEOUT_MS,
      delivery: "sending",
    };
    this.updateConversation(conversation, {
      sending: true,
      lines: existing
        ? conversation.lines.map((l) => (l.id === id ? line : l))
        : [...conversation.lines, line],
    });
    const sent = await this.sendPacket(contact.publicKey, contact.address, {
      v: 3,
      t: "text",
      id,
      c: contact.conversation,
      body: line.body,
    });
    if (
      ticket !== this.connection ||
      !this.isCurrent(conversation)
    )
      return false;
    this.updateConversation(conversation, {
      sending: false,
      ...(!sent
        ? {
            lines: conversation.lines.map((l) =>
              l.id === id ? { ...l, delivery: "unconfirmed" } : l,
            ),
          }
        : {}),
    });
    return sent;
  }

  async joinRoom(value?: string) {
    const ticket = ++this.roomEpoch,
      epoch = this.epoch;
    const room = await openRoom(value);
    if (!room) {
      this.patch({ note: "This room link is invalid. Ask for a new one." });
      return false;
    }
    const identity = await createDeviceIdentity();
    if (ticket !== this.roomEpoch || epoch !== this.epoch) {
      room.key.fill(0);
      room.authSecret.fill(0);
      wipeIdentity(identity);
      return false;
    }
    this.setAvailable(false);
    this.listVersion++;
    this.listing = 0;
    this.peerLeases.clear();
    this.room?.key.fill(0);
    this.room?.authSecret.fill(0);
    wipeIdentity(this.roomIdentity);
    this.room = room;
    this.roomIdentity = identity;
    this.patch({
      room: { id: room.id, token: room.token },
      peers: [],
      directory: "idle",
      note: "",
    });
    this.nextList = 0;
    if (this.discover) void this.loadDirectory();
    return true;
  }
  leaveRoom = () => {
    this.roomEpoch += 1;
    this.setAvailable(false);
    this.listVersion++;
    this.listing = 0;
    this.peerLeases.clear();
    this.room?.key.fill(0);
    this.room?.authSecret.fill(0);
    wipeIdentity(this.roomIdentity);
    this.room = null;
    this.roomIdentity = null;
    this.patch({ room: null, peers: [], directory: "idle" });
  };
  setDiscover(open: boolean) {
    this.discover = open;
    if (open) {
      this.nextList = 0;
      void this.loadDirectory();
    }
  }
  async loadDirectory() {
    const room = this.room;
    if (
      this.listing ||
      !this.discover ||
      !room ||
      this.state.link !== "connected" ||
      !this.wanted
    )
      return;
    const epoch = this.epoch,
      connection = this.connection,
      version = ++this.listVersion;
    this.listing = version;
    this.patch({
      directory:
        this.state.directory === "idle" ? "loading" : this.state.directory,
    });
    this.nextList = this.clock() + 30_000;
    try {
      const entries = await this.directory.list(room.id);
      const peers: LiveInvite[] = [];
      const leases = new Map<string, number>();
      for (const entry of entries) {
        if (room !== this.room) break;
        const invite = await openPresence(room, entry, this.clock());
        if (
          invite &&
          invite.publicKey !== this.identity?.publicKey &&
          !peers.some((p) => p.publicKey === invite.publicKey)
        ) {
          peers.push(invite);
          leases.set(
            invite.publicKey,
            Math.min(entry.onlineUntil, invite.expiresAt),
          );
        }
      }
      if (
        epoch === this.epoch &&
        connection === this.connection &&
        version === this.listVersion &&
        room === this.room &&
        this.discover
      ) {
        this.peerLeases = leases;
        this.patch({ peers, directory: "ready" });
      }
    } catch {
      if (
        epoch === this.epoch &&
        connection === this.connection &&
        version === this.listVersion &&
        room === this.room
      )
        this.patch({ peers: [], directory: "error" });
    } finally {
      if (this.listing === version) this.listing = 0;
    }
  }
  setAvailable(enabled: boolean) {
    this.presenceEpoch += 1;
    if (!enabled) {
      const invite = this.state.invite,
        identity = this.roomIdentity,
        room = this.room;
      const wasPublished = this.state.availableUntil !== null;
      // Revocation is local and immediate, even if the directory removal fails.
      this.inviteEpoch += 1;
      this.invitationWork = null;
      this.patch({
        availableUntil: null,
        presence: "off",
        invite: null,
        requests: [],
      });
      if (wasPublished && identity && invite && room) {
        const copy = {
          ...identity,
          signingSecret: new Uint8Array(identity.signingSecret),
        };
        const revision = ++this.revision,
          connection = this.connection;
        void presenceCommand(copy, room, invite, "remove", revision)
          .then((command) => {
            if (
              connection === this.connection &&
              this.state.link === "connected"
            )
              return this.directory.publish(command);
          })
          .catch(() => undefined)
          .finally(() => copy.signingSecret.fill(0));
      }
      return;
    }
    if (
      !this.identity ||
      !this.room ||
      !this.roomIdentity ||
      this.state.link !== "connected" ||
      !this.state.canStartConversation
    )
      return;
    const ticket = this.presenceEpoch;
    this.patch({ presence: "publishing", note: "" });
    void this.makeInvite()
      .then((invite) => {
        if (
          ticket !== this.presenceEpoch ||
          !invite ||
          this.state.link !== "connected"
        )
          return;
        this.patch({ availableUntil: invite.expiresAt });
        void this.heartbeat();
      })
      .catch(() => {
        if (ticket === this.presenceEpoch)
          this.patch({ presence: "error", availableUntil: null });
      });
  }
  private async heartbeat() {
    const invite = this.state.invite,
      identity = this.roomIdentity,
      issuer = this.identity,
      room = this.room,
      ticket = this.presenceEpoch;
    if (
      this.publishing ||
      !invite ||
      !identity ||
      !issuer ||
      !room ||
      !this.state.availableUntil ||
      this.state.link !== "connected"
    )
      return;
    this.publishing = true;
    this.nextHeartbeat = this.clock() + PRESENCE_HEARTBEAT_MS;
    const revision = ++this.revision;
    try {
      const command = await presenceCommand(
        identity,
        room,
        invite,
        "upsert",
        revision,
        issuer,
      );
      if (ticket !== this.presenceEpoch) return;
      await this.directory.publish(command);
      if (ticket === this.presenceEpoch) this.patch({ presence: "online" });
    } catch {
      if (ticket === this.presenceEpoch) {
        this.setAvailable(false);
        this.patch({
          presence: "error",
          note: "Discover is paused. Retry over Nym, or share a chat invite.",
        });
      }
    } finally {
      this.publishing = false;
    }
  }
  tick() {
    const now = this.clock();
    const changes: Partial<ChatSnapshot> = {
      now,
      peers: this.state.peers.filter(
        (p) =>
          p.expiresAt > now && (this.peerLeases.get(p.publicKey) ?? 0) > now,
      ),
    };
    if (this.state.invite && this.state.invite.expiresAt <= now) {
      this.setAvailable(false);
      changes.invite = null;
      changes.requests = [];
      changes.note =
        "Your invite expired. Create a new one to receive requests.";
    }
    const checkPeers: string[] = [];
    for (const conversation of this.conversations.values()) {
      const { contact } = conversation;
      if (contact.status === "requesting" && contact.request!.expiresAt <= now) {
        this.removeConversation(conversation, "The request expired before it was accepted.");
        continue;
      }
      if (conversation.probe && conversation.probe.deadline <= now) {
        conversation.probe = null;
        conversation.note = "The other person has not responded. Check again when they reconnect.";
      }
      let missedAck = false;
      conversation.lines = conversation.lines.map(line => {
        if (line.direction === "out" && ["sending", "waiting"].includes(line.delivery) &&
            (line.deadline ?? Infinity) <= now) {
          missedAck = true;
          return { ...line, delivery: "unconfirmed" };
        }
        return line;
      });
      if (missedAck && contact.ready) checkPeers.push(contact.conversation);
    }
    this.patch(changes);
    if (this.routeProbe && this.routeProbe.deadline <= now) {
      this.handleTransport(
        { type: "status", status: "failed", reason: "timeout" },
        this.connection,
      );
    } else {
      for (const id of checkPeers) void this.checkPeer(id);
      if (this.state.link === "connected" && now >= this.nextRouteCheck)
        this.checkRoute();
    }
    if (this.retryAt && now >= this.retryAt && this.wanted) this.connect();
    if (this.discover && now >= this.nextList) void this.loadDirectory();
    if (this.state.availableUntil && now >= this.nextHeartbeat)
      void this.heartbeat();
  }
}
