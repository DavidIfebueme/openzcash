"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  IconPencil,
  IconPrivateChat,
  IconShield,
} from "@/components/icons";
import { ChatController, type ChatLine } from "@/lib/private-chat/controller";
import { REACTIONS, type Reaction } from "@/lib/private-chat/protocol";
import { createNymTransport } from "@/lib/private-chat/transport";
import {
  liveInviteUrl,
  parseLiveInvite,
  INVITE_TTL_MS,
} from "@/lib/private-chat/live-invite";
import { CHAT_READY_MESSAGE, CHAT_LEAVE_RESULT, embeddedInvitation, embeddedShellRequest } from "@/lib/private-chat/embedding";
import { normalizeAlias } from "@/lib/private-chat/session";
import { ChatComposer } from "./chat-composer";
import { ChatHelp } from "./chat-help";
import { ChatNetworkStatus } from "./chat-network-status";
import { ChatConfirm } from "@/components/private-chat-confirm";
import { useChatSession } from "@/components/private-chat-session";
import {
  ChatIcon,
  ClockIcon,
  DoubleCheckIcon,
  ExitIcon,
  LinkIcon,
  PowerIcon,
  ReplyIcon,
  SmileIcon,
} from "./chat-ui-icons";
import styles from "./private-chat.module.css";

function subscribeLocation(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}
const browserLocation = () => window.location.href;
const serverLocation = () => "";

function clearChatFragment() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!fragment.has("invite") && !fragment.has("room")) return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function timeLeft(until: number, now: number) {
  const seconds = Math.min(
    INVITE_TTL_MS / 1000,
    Math.max(0, Math.ceil((until - now) / 1000)),
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
const deliveryLabels: Record<ChatLine["delivery"], string> = {
  sending: "Sending…",
  waiting: "Awaiting confirmation",
  delivered: "Delivered",
  unconfirmed: "No confirmation",
};
const reactionLabels: Record<Reaction, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "😂": "Laugh",
  "😮": "Surprised",
  "😢": "Sad",
  "🙏": "Thanks",
};

export function PrivateChatPreview({
  createTransport = createNymTransport,
  parentOrigin = null,
  portalShell = false,
}: {
  createTransport?: typeof createNymTransport;
  parentOrigin?: string | null;
  portalShell?: boolean;
}) {
  const [chat] = useState(() => new ChatController(createTransport, Date.now));
  const state = useSyncExternalStore(
    chat.subscribe,
    chat.getSnapshot,
    chat.getSnapshot,
  );
  const [alias, setAlias] = useState("");
  const [editing, setEditing] = useState(true);
  const [aliasError, setAliasError] = useState("");
  const location = useSyncExternalStore(
    subscribeLocation,
    browserLocation,
    serverLocation,
  );
  const incomingInvite = location
    ? new URLSearchParams(new URL(location).hash.slice(1)).get("invite") || ""
    : "";
  const incomingRoom = location
    ? new URLSearchParams(new URL(location).hash.slice(1)).get("room") || ""
    : "";
  const [inviteFromLink, setInviteFromLink] = useState(false);
  const [joinVisible, setJoinOpen] = useState<boolean | null>(null);
  const [joinDraft, setJoin] = useState<string | null>(null);
  const joinOpen = joinVisible ?? !!incomingInvite;
  const join = joinDraft ?? incomingInvite;
  const [mobileList, setMobileList] = useState(false);
  const captureInvitation = useCallback((kind: "room" | "invite", token: string) => {
    if (kind === "room") {
      // Private rooms were retired with the directory; only direct invites remain.
      chat.setNote("Private rooms are no longer available. Ask the person for a direct chat invite instead.");
      return;
    }
    chat.selectConversation(null);
    setJoin(token);
    setJoinOpen(true);
    setInviteFromLink(true);
    setMobileList(false);
  }, [chat]);
  useEffect(() => {
    if (!incomingInvite && !incomingRoom) return;
    // Capture the fragment in memory, then remove it from the address bar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    captureInvitation(incomingRoom ? "room" : "invite", incomingRoom || incomingInvite);
    clearChatFragment();
  }, [captureInvitation, incomingInvite, incomingRoom]);
  useEffect(() => {
    if (!parentOrigin || window.parent === window) return;
    const receive = (event: MessageEvent) => {
      const invitation = embeddedInvitation(event, window.parent, parentOrigin);
      if (invitation) captureInvitation(invitation.kind, invitation.token);
    };
    window.addEventListener("message", receive);
    // No identity, keys or chat contents leave the frame.
    window.parent.postMessage({ type: CHAT_READY_MESSAGE }, parentOrigin);
    return () => window.removeEventListener("message", receive);
  }, [captureInvitation, parentOrigin]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Replies and the open message menu are per tab, like drafts: nothing is stored.
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [messageMenu, setMessageMenu] = useState<{ id: string; picker: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const replyTo = state.activeConversationId ? replies[state.activeConversationId] : undefined;
  const lineById = useMemo(() => new Map(state.lines.map((line) => [line.id, line])), [state.lines]);
  const quotedReply = replyTo ? lineById.get(replyTo) : undefined;
  const draft = state.activeConversationId ? drafts[state.activeConversationId] ?? "" : "";
  const unreadCount = state.conversations.reduce((total, conversation) => total + conversation.unread, 0);
  const origin = parentOrigin ?? (location ? new URL(location).origin : "");
  const [copied, setCopied] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  // A link from someone who already asked is answered, not requested back.
  const pendingFromLink = useMemo(() => {
    const parsed = join.trim() ? parseLiveInvite(join) : null;
    return parsed ? state.requests.find((item) => item.publicKey === parsed.publicKey) ?? null : null;
  }, [join, state.requests]);
  const aliasInput = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLOListElement>(null);
  const followingMessages = useRef(true);
  const [unread, setUnread] = useState(false);
  const [clearAction, setClearAction] = useState<"session" | "identity" | "conversation" | null>(null);
  const [clearTarget, setClearTarget] = useState<string | null>(null);
  const [leaveRequest, setLeaveRequest] = useState<string | null>(null);
  const endingConversation = state.conversations.find(conversation => conversation.id === clearTarget);
  const session = useChatSession();
  const setSessionActive = session?.setActive;
  const lastLine = state.lines.at(-1)?.id;
  const lastDirection = state.lines.at(-1)?.direction;
  const now = state.now;
  const connected = state.link === "connected";
  const connecting = ["connecting", "checking", "reconnecting"].includes(
    state.link,
  );
  const canSend =
    connected && state.contact?.status === "active" && state.contact.ready;
  const linkLabel = {
    disconnected: "Not connected",
    connecting: "Connecting…",
    checking: "Checking route…",
    connected: "Connected via Nym",
    failed: "Connection paused",
    reconnecting: `Reconnecting · ${state.retry}/3`,
    offline: "You’re offline",
  }[state.link];
  const gettingStarted = !state.keyReady || (!connected && !state.conversations.length);

  useEffect(() => {
    setSessionActive?.(!!state.alias || !!join);
    return () => setSessionActive?.(false);
  }, [setSessionActive, state.alias, join]);

  const leave = useCallback(() => {
    chat.leave();
    setAlias("");
    setAliasError("");
    setDrafts({});
    setReplies({});
    setMessageMenu(null);
    setMobileList(false);
    setJoin("");
    setJoinOpen(false);
    setInviteFromLink(false);
    setClearAction(null);
    setClearTarget(null);
    setUnread(false);
    followingMessages.current = true;
    setCopied(false);
    setRequestBusy(false);
    setAcceptingId(null);
    setEditing(true);
    clearChatFragment();
  }, [chat, setClearAction]);

  const answerLeaveRequest = useCallback((id: string, approved: boolean) => {
    if (parentOrigin) window.parent.postMessage({ type: CHAT_LEAVE_RESULT, id, approved }, parentOrigin);
    setLeaveRequest(null);
  }, [parentOrigin]);

  useEffect(() => {
    if (!portalShell || !parentOrigin || window.parent === window) return;
    const receive = (event: MessageEvent) => {
      const request = embeddedShellRequest(event, window.parent, parentOrigin);
      if (request?.type !== "leave") return;
      if (alias || state.alias || join) setLeaveRequest(current => current ?? request.id);
      else answerLeaveRequest(request.id, true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [portalShell, parentOrigin, alias, state.alias, join, answerLeaveRequest]);

  useEffect(() => {
    chat.start();
    const offline = () => chat.network(false),
      online = () => chat.network(true);
    const pagehide = () => leave();
    const pageshow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      leave();
      chat.setNote("Session cleared after leaving this page.");
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("pageshow", pageshow);
    if (!navigator.onLine) chat.network(false);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("pageshow", pageshow);
      chat.dispose();
    };
  }, [chat, leave]);
  useEffect(() => {
    if (!messageMenu) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest?.(`#message-${messageMenu.id}`)) setMessageMenu(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [messageMenu]);
  useEffect(() => {
    const updateVisibility = () => chat.setConversationVisible(
      !mobileList && document.visibilityState !== "hidden",
    );
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, [chat, mobileList]);
  useEffect(() => {
    if (!thread.current) return;
    if (followingMessages.current || lastDirection === "out") {
      thread.current.scrollTop = thread.current.scrollHeight;
    } else if (lastDirection === "in") {
      // Reflect an external scroll position without interrupting history reading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnread(true);
    }
  }, [lastLine, lastDirection, state.activeConversationId, mobileList]);

  async function enter(event: FormEvent) {
    event.preventDefault();
    if (!normalizeAlias(alias)) {
      setAliasError(
        "Use 2–24 letters, numbers, spaces, dots, hyphens or underscores.",
      );
      aliasInput.current?.focus();
      return;
    }
    if (await chat.enter(alias)) {
      setEditing(false);
      setAliasError("");
    }
  }
  function showConversation() {
    setMobileList(false);
    followingMessages.current = true;
    setUnread(false);
  }
  function selectConversation(id: string | null) {
    chat.selectConversation(id);
    showConversation();
    setMessageMenu(null);
    setCopied(false);
  }
  function updateDraft(value: string) {
    const id = state.activeConversationId;
    if (!id) return;
    setDrafts(current => ({
      ...Object.fromEntries(Object.entries(current).filter(([key]) => state.conversations.some(c => c.id === key))),
      [id]: value,
    }));
  }
  async function request(value: string) {
    if (requestBusy) return;
    setRequestBusy(true);
    try {
      if (await chat.requestChat(value)) {
        setJoinOpen(false);
        setJoin("");
        setInviteFromLink(false);
        clearChatFragment();
        showConversation();
      }
    } finally {
      setRequestBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft;
    const id = state.activeConversationId;
    followingMessages.current = true;
    setUnread(false);
    const quoted = id ? replies[id] : undefined;
    if (id && await chat.send(text, undefined, quoted)) {
      setDrafts(current => current[id] === text ? { ...current, [id]: "" } : current);
      setReplies(current => current[id] === quoted
        ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== id))
        : current);
    }
  }

  function startReply(lineId: string) {
    const id = state.activeConversationId;
    if (!id) return;
    setReplies(current => ({ ...current, [id]: lineId }));
    setMessageMenu(null);
    document.getElementById("chat-message")?.focus();
  }
  function cancelReply() {
    const id = state.activeConversationId;
    if (!id) return;
    setReplies(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
  }
  function toggleReaction(lineId: string, emoji: Reaction) {
    const mine = lineById.get(lineId)?.reactions?.mine;
    void chat.react(lineId, mine === emoji ? "" : emoji);
    setMessageMenu(null);
  }
  function jumpTo(lineId: string) {
    document.getElementById(`message-${lineId}`)?.scrollIntoView?.({
      block: "center",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
    });
    setFlash(lineId);
    window.setTimeout(() => setFlash(current => (current === lineId ? null : current)), 1400);
  }

  async function acceptPending(id: string) {
    setAcceptingId(id);
    showConversation();
    try {
      await chat.acceptRequest(id);
    } finally {
      setAcceptingId(null);
    }
  }
  function declinePending(id: string) {
    return chat.rejectRequest(id);
  }

  function clearConversation() {
    const id = clearTarget;
    if (id) chat.endConversation(id);
    setDrafts(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setReplies(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setUnread(false);
    followingMessages.current = true;
    setClearAction(null);
  }

  const inviteActions = (
    <div className={styles.newChatActions}>
      <button
        className={styles.primaryButton}
        disabled={!connected || !state.canStartConversation}
        onClick={() => {
          setCopied(false);
          void chat.makeInvite();
        }}
      >
        <LinkIcon />
        Create invite
      </button>
      <button
        className={styles.secondaryButton}
        disabled={!state.keyReady || !state.canStartConversation}
        aria-expanded={joinOpen}
        onClick={() => setJoinOpen(!joinOpen)}
      >
        Join with a link
      </button>
    </div>
  );

  return (
    <section className={styles.page} data-portal-shell={portalShell || undefined} aria-labelledby="private-chat-title">
      <header className={styles.heading}>
        <div>
          <h1 id="private-chat-title">
            Private Chat <span className={styles.previewBadge}>{process.env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT === "true" ? "Experimental pilot" : "Preview"}</span>
          </h1>
        </div>
      </header>
      <div
        className={styles.workspace}
        data-ready={!!state.alias}
        data-onboarding={gettingStarted}
        data-chat-active={!!state.contact && !mobileList}
        data-chat-list={mobileList}
      >
        <aside
          className={styles.identityColumn}
          aria-label="Your chat identity"
        >
          <section className={styles.identityCard}>
            {editing || !state.alias ? (
              <form className={styles.aliasForm} onSubmit={enter}>
                <label htmlFor="chat-alias">Your alias</label>
                <input
                  ref={aliasInput}
                  id="chat-alias"
                  value={alias}
                  onChange={(event) => {
                    setAlias(event.target.value);
                    setAliasError("");
                  }}
                  maxLength={48}
                  placeholder="Choose an alias"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!aliasError}
                  aria-describedby={aliasError ? "alias-error" : undefined}
                />
                {aliasError && (
                  <p id="alias-error" role="alert" className={styles.error}>
                    {aliasError}
                  </p>
                )}
                {state.alias && (
                  <p className={styles.aliasPrivacyNote}>
                    Changing your alias keeps the same chat identity. Your current contact may still see your old alias.
                    <button
                      type="button"
                      onClick={() => setClearAction("identity")}
                    >
                      Start a new identity
                    </button>
                  </p>
                )}
                {!state.alias && <p className={styles.aliasHint}>No account. Just a name for this session.</p>}
                <button className={styles.primaryButton} disabled={state.busy}>
                  {state.busy
                    ? "Preparing…"
                    : state.alias
                      ? "Save alias"
                      : "Continue"}
                </button>
              </form>
            ) : (
              <div className={styles.identityRow}>
                <span className={styles.avatar}>
                  {state.alias?.slice(0, 1).toUpperCase()}
                </span>
                <div className={styles.identitySummary}>
                  <h2>{state.alias}</h2>
                  <span>Temporary alias</span>
                </div>
                <button
                  className={styles.iconButton}
                  aria-label="Edit alias"
                  title="Edit alias"
                  onClick={() => {
                    setAlias(state.alias ?? "");
                    setEditing(true);
                  }}
                >
                  <IconPencil />
                </button>
              </div>
            )}
          </section>
          <section
            className={styles.transport}
            data-state={state.link}
            aria-label="Nym connection"
          >
            {/* Official Nym wordmark, sourced from https://nym.com/press. */}
            <svg
              className={styles.nymLogo}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 91.8 24"
              width="69"
              height="18"
              role="img"
              aria-label="Nym"
            >
              <path
                fill="currentColor"
                d="m17.7 21.7-5.1-19C12.2 1.1 10.8 0 9.2 0H3.6C1.6 0 0 1.6 0 3.6V24h6V2.4c0-.3.4-.4.5 0l5.1 19c.4 1.6 1.8 2.7 3.5 2.7h5.6c2 0 3.6-1.6 3.6-3.6V0h-6v21.6c0 .3-.4.4-.5 0ZM85.9 0h-3.3c-1.6 0-3 1.1-3.4 2.7l-5 18.7c-.2.7-1.1.7-1.3 0l-5-18.7C67.4 1.1 66 0 64.4 0h-5.6c-2 0-3.6 1.6-3.6 3.6V24h6V2.4c0-.3.4-.4.5 0l5.1 19c.4 1.6 1.8 2.7 3.5 2.7h6.4c1.6 0 3-1.1 3.5-2.7l5.1-19c0-.3.5-.2.5 0V24h6V3.6c0-2-1.6-3.6-3.6-3.6zM47.7 0l-6.9 12c-.3.5-1.1.5-1.4 0L32.6 0h-6.4l7 12.1c.5.9 1.5 1.4 2.5 1.4H40l-6 10.4h6.3L54.1 0h-6.3Z"
              />
            </svg>
            <span
              id="nym-connection-status"
              className={styles.connectionStatus}
              role="status"
              aria-atomic="true"
            >
              <span
                className={styles.statusDot}
                data-state={state.link}
                aria-hidden="true"
              />
              {linkLabel}
            </span>
            <button
              type="button"
              className={styles.connectionSwitch}
              role="switch"
              aria-label="Nym connection"
              aria-checked={state.connectionWanted}
              aria-describedby="nym-connection-status"
              title={
                !state.keyReady
                  ? "Choose an alias first"
                  : state.connectionWanted
                    ? "Disconnect"
                    : connecting
                      ? "Cancel connection"
                      : state.contact
                        ? "Reconnect"
                        : "Connect"
              }
              disabled={!state.keyReady}
              onClick={
                state.connectionWanted ? chat.disconnect : chat.reconnect
              }
            >
              <span aria-hidden="true">
                <PowerIcon />
              </span>
            </button>
          </section>
          <ChatNetworkStatus />
          {state.keyReady && <section className={styles.chatList} aria-label="Conversations in this tab">
            {state.requests.length > 0 && <div className={styles.requestList} role="group" aria-label="Chat requests">
              <h2 className={styles.requestHeading}>Requests <span className={styles.unreadCount}>{state.requests.length}</span></h2>
              <ul>
                {state.requests.map((item) => <li key={item.packet.id} className={styles.requestRow} aria-label={`Chat request from ${item.packet.alias}`}>
                  <span className={styles.chatAvatar} aria-hidden="true">{item.packet.alias.slice(0, 1)}</span>
                  <div className={styles.requestInfo}>
                    <h3>{item.packet.alias}</h3>
                    <p>Wants to chat with you</p>
                  </div>
                  <div className={styles.requestActions}>
                    <button type="button" className={styles.secondaryButton} onClick={() => void declinePending(item.packet.id)}>Decline</button>
                    <button type="button" className={styles.primaryButton} disabled={acceptingId !== null} onClick={() => void acceptPending(item.packet.id)}>
                      {acceptingId === item.packet.id ? "Accepting…" : "Accept"}
                    </button>
                  </div>
                </li>)}
              </ul>
            </div>}
            <div className={styles.chatListHeading}>
              <h2>Your chats</h2>
              <button type="button" className={styles.newChatButton}
                disabled={!state.canStartConversation}
                onClick={() => selectConversation(null)}>
                <span aria-hidden="true">+</span> New chat
              </button>
            </div>
            {state.conversations.length ? <ul>
              {state.conversations.map(conversation => <li key={conversation.id}>
                <button type="button" className={styles.conversationLink}
                  aria-current={state.activeConversationId === conversation.id ? "true" : undefined}
                  aria-label={`Chat with ${conversation.alias}${conversation.unread ? `, ${conversation.unread} unread` : ""}`}
                  onClick={() => selectConversation(conversation.id)}>
                  <span className={styles.chatAvatar} aria-hidden="true">{conversation.alias.slice(0, 1)}</span>
                  <span className={styles.chatPreview}>
                    <strong>{conversation.alias}</strong>
                    <small>{conversation.status === "ended" ? "Conversation ended"
                      : conversation.status === "requesting" ? "Waiting for acceptance"
                      : conversation.lastMessage || (connected && conversation.ready ? "Ready to chat" : "Waiting for connection")}</small>
                  </span>
                  {conversation.unread > 0 && <span className={styles.unreadCount}>{conversation.unread}</span>}
                </button>
              </li>)}
            </ul> : <p className={styles.chatListEmpty}>Your conversations appear here.</p>}
            {!state.canStartConversation && <p className={styles.chatListEmpty}>8 chats open. End one to start another.</p>}
          </section>}
          <div className={styles.sidebarFooter}>
            <span>
              <IconPrivateChat />
              This tab only
            </span>
            {state.alias && (
              <button
                className={styles.leaveButton}
                aria-label="Leave & clear session"
                onClick={() => setClearAction("session")}
              >
                <ExitIcon />
                Leave & clear
              </button>
            )}
          </div>
        </aside>

        <section
          className={styles.conversationCard}
          aria-label="Chat workspace"
        >
          {!gettingStarted && !state.contact && (
            <header className={styles.paneHeading}>
              <span>
                <ChatIcon />
                Direct messages
              </span>
              <span className={styles.paneMeta}>
                <IconShield />
                End-to-end encrypted
              </span>
            </header>
          )}
          <div
            id="chat-panel"
            role="region"
            aria-labelledby={gettingStarted ? "onboarding-title" : undefined}
            aria-label={gettingStarted ? undefined : "Conversation"}
            className={styles.panel}
            data-chat={!!state.contact}
          >
            {state.note &&
              ![
                "Disconnected.",
                "Conversation kept in this tab. Reconnect when you’re ready.",
                "Invite revoked.",
                "Accepted. Confirming the connection…",
                "Checking the other person’s connection…",
                "Waiting for the other person to accept.",
                "Verifying a round trip through Nym…",
              ].includes(state.note) && (
                <p className={styles.notice} role="status">
                  {state.note}
                </p>
              )}
            {gettingStarted ? (
              <div className={styles.onboarding}>
                <ol className={styles.steps} aria-label="Getting started progress">
                  {["Alias", "Connect", "Chat"].map((label, index) => (
                    <li key={label} aria-current={index === (state.keyReady ? 1 : 0) ? "step" : undefined} data-complete={index === 0 && state.keyReady}>
                      <span>{index === 0 && state.keyReady ? "✓" : `0${index + 1}`}</span>{label}
                    </li>
                  ))}
                </ol>
                <span className={styles.onboardingMark}><IconPrivateChat /></span>
                {inviteFromLink && <span className={styles.invitationBadge}><LinkIcon />Chat invitation received</span>}
                <h2 id="onboarding-title">{!state.keyReady ? "Start with your alias." : connecting ? "Making a private connection…" : "Connect. Then say hello."}</h2>
                <p>{!state.keyReady ? "Choose an alias to get started. Your messages stay in this tab." : connecting ? "Waiting for a signal to return through Nym. This can take a moment." : "Switch on Nym to continue. Nothing leaves this tab until you share an invite."}</p>
                {state.keyReady && <button className={styles.primaryButton} disabled={state.link === "offline" && !state.connectionWanted} onClick={state.connectionWanted ? chat.disconnect : chat.reconnect}>
                  <PowerIcon />{state.connectionWanted ? "Cancel connection" : state.link === "failed" ? "Try again" : "Connect to Nym"}
                </button>}
                <span className={styles.onboardingFoot}><IconShield />End-to-end encrypted · One to one</span>
              </div>
            ) : state.contact ? (
              <>
                <header className={styles.contactCard}>
                  <button type="button" className={styles.backToChats} aria-label="Back to chats"
                    onClick={() => { setMobileList(true); chat.setConversationVisible(false); }}>
                    <span aria-hidden="true">‹</span><span>Chats</span>
                    {unreadCount > 0 && <span className={styles.unreadCount}>{unreadCount}</span>}
                  </button>
                  <div className={styles.identityRow}>
                    <span className={styles.avatar}>
                      {state.contact.alias.slice(0, 1)}
                    </span>
                    <div>
                      <h2>{state.contact.alias}</h2>
                      <p>
                        {state.contact.status === "requesting"
                          ? "Waiting for acceptance"
                          : state.contact.status === "ended"
                            ? "Conversation ended"
                            : connected && state.contact.ready
                              ? "Encrypted conversation"
                              : connected
                                ? "Confirming connection"
                                : "Waiting to reconnect"}
                      </p>
                    </div>
                  </div>
                  <button
                    className={styles.textButton}
                    onClick={() => { setClearTarget(state.activeConversationId); setClearAction("conversation"); }}
                  >
                    {state.contact.status === "ended" ? "New conversation" : "End chat"}
                  </button>
                </header>
                <details className={styles.safety}>
                  <summary>
                    <span className={styles.safetyLabel}>
                      <IconShield />
                      Safety code
                    </span>
                    <code>{state.contact.code}</code>
                  </summary>
                  <p>
                    Compare all five groups through a trusted channel. An alias
                    alone does not verify who you are chatting with.
                  </p>
                </details>
                {state.contact.status === "requesting" ? (
                  <div className={styles.emptyState}>
                    <IconPrivateChat />
                    <h3>Waiting for {state.contact.alias}</h3>
                    <p>
                      Expires in{" "}
                      {timeLeft(state.contact.request!.expiresAt, now)}.
                    </p>
                    <button
                      className={styles.secondaryButton}
                      disabled={!connected}
                      onClick={() => void chat.retryRequest()}
                    >
                      Send request again
                    </button>
                  </div>
                ) : (
                  <>
                    <ol
                      className={styles.thread}
                      ref={thread}
                      aria-label="Messages"
                      aria-live="polite"
                      aria-relevant="additions text"
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && messageMenu) {
                          event.preventDefault();
                          setMessageMenu(null);
                        }
                      }}
                      onScroll={(event) => {
                        const element = event.currentTarget;
                        followingMessages.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
                        if (followingMessages.current) setUnread(false);
                      }}
                    >
                      {state.lines.map((line, index) => (
                        <li
                          key={line.id}
                          id={`message-${line.id}`}
                          className={styles.message}
                          data-direction={line.direction}
                          data-selected={messageMenu?.id === line.id || undefined}
                          data-flash={flash === line.id || undefined}
                          onClick={(event) => {
                            // Tapping the bubble itself shows its actions on touch screens.
                            if ((event.target as Element).closest("button, a")) return;
                            setMessageMenu(current => current?.id === line.id && !current.picker ? null : { id: line.id, picker: false });
                          }}
                          data-grouped={
                            index > 0 &&
                            state.lines[index - 1].direction ===
                              line.direction &&
                            line.at - state.lines[index - 1].at < 120_000
                          }
                          data-emoji={
                            line.body.length <= 32 &&
                            /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\s]+$/u.test(
                              line.body,
                            )
                          }
                        >
                          <span className={styles.srOnly}>
                            {line.direction === "out"
                              ? "You"
                              : state.contact?.alias}
                          </span>
                          {line.replyTo && (() => {
                            const quoted = lineById.get(line.replyTo);
                            const author = quoted ? (quoted.direction === "out" ? "You" : state.contact?.alias ?? "") : null;
                            return (
                              <button
                                type="button"
                                className={styles.quote}
                                disabled={!quoted}
                                aria-label={quoted ? `Replying to ${author}: ${quoted.body}. Show the original message` : "Original message not available"}
                                onClick={() => quoted && jumpTo(quoted.id)}
                              >
                                <strong>{author ?? "Message"}</strong>
                                <span>{quoted ? quoted.body : "Original message not available"}</span>
                              </button>
                            );
                          })()}
                          <p>{line.body}</p>
                          <div className={styles.messageMeta}>
                            <time dateTime={new Date(line.at).toISOString()}>
                              {new Date(line.at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                            {line.direction === "out" && (
                              <span
                                className={styles.delivery}
                                data-delivery={line.delivery}
                                title={deliveryLabels[line.delivery]}
                                aria-label={deliveryLabels[line.delivery]}
                              >
                                {line.delivery === "delivered" ? (
                                  <DoubleCheckIcon />
                                ) : (
                                  <ClockIcon />
                                )}
                                {line.delivery === "unconfirmed" &&
                                  "No confirmation"}
                              </span>
                            )}
                            {line.direction === "out" &&
                              line.delivery === "unconfirmed" && (
                                <button
                                  className={styles.retryButton}
                                  disabled={!canSend || state.sending}
                                  onClick={() =>
                                    void chat.send(line.body, line.id)
                                  }
                                >
                                  Retry
                                </button>
                              )}
                          </div>
                          {line.reactions && (line.reactions.mine || line.reactions.theirs) && (
                            <div className={styles.reactions} aria-label="Reactions">
                              {([...new Set([line.reactions.mine, line.reactions.theirs])].filter(Boolean) as Reaction[]).map((emoji) => {
                                const mine = line.reactions?.mine === emoji;
                                const count = Number(mine) + Number(line.reactions?.theirs === emoji);
                                return (
                                  <button
                                    type="button"
                                    key={emoji}
                                    className={styles.reactionPill}
                                    data-mine={mine || undefined}
                                    aria-pressed={mine}
                                    aria-label={`${reactionLabels[emoji]}, ${count}${mine ? ", including yours" : ""}`}
                                    disabled={!canSend}
                                    onClick={() => toggleReaction(line.id, emoji)}
                                  >
                                    {emoji}<small>{count}</small>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {messageMenu?.id === line.id && messageMenu.picker && (
                            <div className={styles.reactionPicker} role="group" aria-label="Choose a reaction">
                              {REACTIONS.map((emoji) => (
                                <button
                                  type="button"
                                  key={emoji}
                                  aria-label={reactionLabels[emoji]}
                                  aria-pressed={line.reactions?.mine === emoji}
                                  onClick={() => toggleReaction(line.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className={styles.messageTools} role="group" aria-label="Message actions">
                            <button
                              type="button"
                              aria-label="Reply"
                              title="Reply"
                              disabled={state.contact?.status !== "active"}
                              onClick={() => startReply(line.id)}
                            >
                              <ReplyIcon />
                            </button>
                            <button
                              type="button"
                              aria-label="React"
                              title="React"
                              aria-expanded={messageMenu?.id === line.id && messageMenu.picker}
                              disabled={!canSend}
                              onClick={() => setMessageMenu(current => current?.id === line.id && current.picker ? null : { id: line.id, picker: true })}
                            >
                              <SmileIcon />
                            </button>
                          </div>
                        </li>
                      ))}
                      {!state.lines.length && (
                        <li className={styles.threadEmpty}>
                          <span
                            className={styles.helloEmoji}
                            aria-hidden="true"
                          >
                            👋
                          </span>
                          <p>Say hello to {state.contact.alias}.</p>
                        </li>
                      )}
                    </ol>
                    {unread && <button className={styles.unreadButton} onClick={() => {
                      if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
                      followingMessages.current = true;
                      setUnread(false);
                    }}>↓ New messages</button>}
                    {state.contact.status === "ended" && <p className={styles.conversationNotice}>This conversation has ended. Choose “New conversation” to start again.</p>}
                    {state.contact.status === "active" && !connected && <div className={styles.conversationNotice} role="status">
                      <span>{state.link === "offline" ? "You’re offline. Messages are paused." : connecting ? "Reconnecting through Nym…" : "Connection paused. Your messages stay in this tab."}</span>
                      {!state.connectionWanted && state.link !== "offline" && <button className={styles.textButton} onClick={chat.reconnect}>Reconnect</button>}
                      {state.link === "failed" && state.connectionWanted && <button className={styles.textButton} onClick={chat.reconnect}>Try again</button>}
                    </div>}
                    {state.contact.status === "active" &&
                      !state.contact.ready &&
                      connected && (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => void chat.checkPeer()}
                        >
                          Check connection
                        </button>
                      )}
                    {state.contact.status === "active" && (
                      <ChatComposer
                        key={state.activeConversationId}
                        value={draft}
                        onChange={updateDraft}
                        onSend={send}
                        enabled={!!canSend}
                        sending={state.sending}
                        replyTo={quotedReply ? { name: quotedReply.direction === "out" ? "You" : state.contact.alias, body: quotedReply.body } : null}
                        onCancelReply={cancelReply}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {!state.invite && !joinOpen ? (
                  <div className={styles.welcome}>
                    <span className={styles.welcomeMark}>
                      <IconPrivateChat />
                    </span>
                    <h2>Start a private chat</h2>
                    <p>One person per chat. All your chats in this tab.</p>
                    {inviteActions}
                  </div>
                ) : (
                  !inviteFromLink && inviteActions
                )}
                {state.invite && (
                  <section className={styles.invitePanel}>
                    <div className={styles.inviteHeading}>
                      <label htmlFor="invite-link">Your private invite</label>
                      <span>
                        Expires in {timeLeft(state.invite.expiresAt, now)}
                      </span>
                    </div>
                    <div className={styles.inviteRow}>
                      <input
                        id="invite-link"
                        aria-label="Invite link"
                        className={styles.inviteLink}
                        readOnly
                        value={liveInviteUrl(origin, state.invite)}
                      />
                      <button
                        className={styles.secondaryButton}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              liveInviteUrl(origin, state.invite!),
                            );
                            setCopied(true);
                          } catch {
                            chat.setNote("Select the invite link to copy it.");
                          }
                        }}
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className={styles.inviteHeading}>
                      <p>One link · each request opens its own chat</p>
                      <button
                        className={styles.textButton}
                        onClick={chat.revokeInvite}
                      >
                        Revoke
                      </button>
                    </div>
                  </section>
                )}
                {joinOpen && (
                  <form
                    className={styles.invitePanel}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void request(join);
                    }}
                  >
                    {inviteFromLink ? <div className={styles.receivedInvite}><span className={styles.roomMark}><LinkIcon /></span><h2>{pendingFromLink ? `${pendingFromLink.packet.alias} already wants to chat with you` : "You received a chat invite"}</h2><p>{pendingFromLink ? "Accept their request to open the chat. No new request is needed." : "Send a request. The other person chooses whether to accept."}</p></div> : <>
                    <label htmlFor="join-invite">Chat invite</label>
                    <input
                      id="join-invite"
                      className={styles.joinInput}
                      value={join}
                      onChange={(event) => setJoin(event.target.value)}
                      placeholder="Paste an invite link"
                      autoComplete="off"
                      maxLength={2200}
                    />
                    </>}
                    {pendingFromLink ? (
                      <>
                        {!inviteFromLink && <p className={styles.fieldHint}>{pendingFromLink.packet.alias} already sent you a request.</p>}
                        <div className={styles.actions}>
                          <button type="button" className={styles.secondaryButton} onClick={() => void declinePending(pendingFromLink.packet.id)}>Decline</button>
                          <button type="button" className={styles.primaryButton} disabled={acceptingId !== null} onClick={() => void acceptPending(pendingFromLink.packet.id)}>
                            {acceptingId === pendingFromLink.packet.id ? "Accepting…" : `Accept ${pendingFromLink.packet.alias}`}
                          </button>
                        </div>
                      </>
                    ) : (
                    <button
                      className={styles.primaryButton}
                      disabled={!connected || !state.canStartConversation || !join.trim() || requestBusy}
                    >
                      {requestBusy ? "Checking…" : "Request chat"}
                    </button>
                    )}
                    {inviteFromLink && <button type="button" className={styles.textButton} onClick={() => { setInviteFromLink(false); setJoin(""); }}>Use another link</button>}
                    {!connected && (
                      <p className={styles.fieldHint}>
                        Connect to Nym to send your request.
                      </p>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      </div>
      <ChatHelp />
      {leaveRequest && <ChatConfirm
        title="Leave this session?"
        description="Your alias, invites and messages will be cleared from this tab. You cannot restore them here."
        action="Leave & clear"
        onCancel={() => answerLeaveRequest(leaveRequest, false)}
        onConfirm={() => { leave(); answerLeaveRequest(leaveRequest, true); }}
      />}
      {clearAction && <ChatConfirm
        title={clearAction === "conversation" ? endingConversation?.status === "ended" ? "Start a new conversation?" : "End this conversation?" : "Leave this session?"}
        description={clearAction === "conversation" ? "Messages in this conversation will be cleared from this tab. Your alias stays available." : "Your alias, invites and messages will be cleared from this tab. You cannot restore them here."}
        action={clearAction === "conversation" ? endingConversation?.status === "ended" ? "New conversation" : "End & clear chat" : clearAction === "identity" ? "Start a new identity" : "Leave & clear"}
        onCancel={() => setClearAction(null)}
        onConfirm={clearAction === "conversation" ? clearConversation : leave}
      />}
    </section>
  );
}
