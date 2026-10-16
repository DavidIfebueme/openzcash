"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  IconPencil,
  IconPrivateChat,
  IconShield,
  IconUsers,
} from "@/components/icons";
import { ChatController, type ChatLine } from "@/lib/private-chat/controller";
import { createNymTransport } from "@/lib/private-chat/transport";
import { type PresenceService } from "@/lib/private-chat/presence";
import {
  liveInviteUrl,
  inviteToken,
  INVITE_TTL_MS,
} from "@/lib/private-chat/live-invite";
import type { DirectoryConfig } from "@/lib/private-chat/directory-wire";
import { roomUrl } from "@/lib/private-chat/discovery-room";
import { normalizeAlias } from "@/lib/private-chat/session";
import { ChatComposer } from "./chat-composer";
import { ChatHelp } from "./chat-help";
import { ChatConfirm } from "@/components/private-chat-confirm";
import { useChatSession } from "@/components/private-chat-session";
import {
  ChatIcon,
  ClockIcon,
  DoubleCheckIcon,
  ExitIcon,
  LinkIcon,
  PowerIcon,
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

export function PrivateChatPreview({
  createTransport = createNymTransport,
  directory,
  directoryConfig = null,
}: {
  createTransport?: typeof createNymTransport;
  directory?: PresenceService;
  directoryConfig?: DirectoryConfig | null;
}) {
  const [chat] = useState(
    () =>
      new ChatController(createTransport, directory, Date.now, directoryConfig),
  );
  const state = useSyncExternalStore(
    chat.subscribe,
    chat.getSnapshot,
    chat.getSnapshot,
  );
  const [alias, setAlias] = useState("");
  const [editing, setEditing] = useState(true);
  const [aliasError, setAliasError] = useState("");
  const [selectedView, setView] = useState<"conversations" | "discover" | null>(
    null,
  );
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
  const view = selectedView ?? (incomingRoom ? "discover" : "conversations");
  const [roomDraft, setRoomDraft] = useState<string | null>(null);
  const [roomFromLink, setRoomFromLink] = useState(false);
  const [inviteFromLink, setInviteFromLink] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomCopied, setRoomCopied] = useState(false);
  const roomInput = roomDraft ?? incomingRoom;
  const [joinVisible, setJoinOpen] = useState<boolean | null>(null);
  const [joinDraft, setJoin] = useState<string | null>(null);
  const joinOpen = joinVisible ?? !!incomingInvite;
  const join = joinDraft ?? incomingInvite;
  useEffect(() => {
    if (!incomingInvite && !incomingRoom) return;
    // Keep the token in this tab while the person connects, but remove the
    // shareable secret from the address bar as soon as it is captured.
    /* eslint-disable react-hooks/set-state-in-effect -- Capture a URL fragment in memory before removing it. */
    if (incomingRoom) {
      setRoomDraft(incomingRoom);
      setRoomFromLink(true);
      setView("discover");
    } else {
      setJoin(incomingInvite);
      setJoinOpen(true);
      setInviteFromLink(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    clearChatFragment();
  }, [incomingInvite, incomingRoom]);
  const [draft, setDraft] = useState("");
  const origin = location ? new URL(location).origin : "";
  const [copied, setCopied] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const aliasInput = useRef<HTMLInputElement>(null);
  const thread = useRef<HTMLOListElement>(null);
  const followingMessages = useRef(true);
  const [unread, setUnread] = useState(false);
  const [clearAction, setClearAction] = useState<"session" | "identity" | "conversation" | null>(null);
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
  const gettingStarted = !state.keyReady || (!connected && !state.contact && !state.room);

  useEffect(() => {
    setSessionActive?.(!!state.alias || !!state.room || !!join || !!roomInput);
    return () => setSessionActive?.(false);
  }, [setSessionActive, state.alias, state.room, join, roomInput]);

  const leave = useCallback(() => {
    chat.leave();
    setAlias("");
    setAliasError("");
    setDraft("");
    setJoin("");
    setJoinOpen(false);
    setRoomDraft("");
    setRoomBusy(false);
    setRoomCopied(false);
    setRoomFromLink(false);
    setInviteFromLink(false);
    setClearAction(null);
    setUnread(false);
    followingMessages.current = true;
    setCopied(false);
    setRequestBusy(false);
    setAcceptingId(null);
    setView(null);
    setEditing(true);
    clearChatFragment();
  }, [chat, setClearAction]);

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
    chat.setDiscover(view === "discover");
  }, [chat, view]);
  useEffect(() => {
    if (!thread.current) return;
    if (followingMessages.current || lastDirection === "out") {
      thread.current.scrollTop = thread.current.scrollHeight;
    } else if (lastDirection === "in") {
      // Reflect an external scroll position without interrupting history reading.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnread(true);
    }
  }, [lastLine, lastDirection, view]);

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
  function changeView(next: typeof view) {
    setView(next);
    followingMessages.current = true;
    setUnread(false);
  }
  async function joinRoom(value?: string) {
    if (roomBusy) return;
    setRoomBusy(true);
    try {
      if (await chat.joinRoom(value)) {
        setRoomDraft("");
        setRoomCopied(false);
        setRoomFromLink(false);
        clearChatFragment();
        setView("discover");
      }
    } catch {
      chat.setNote("Could not open the room. Please try again.");
    } finally {
      setRoomBusy(false);
    }
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
        changeView("conversations");
      }
    } finally {
      setRequestBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft;
    followingMessages.current = true;
    setUnread(false);
    if (await chat.send(text))
      setDraft((current) => (current === text ? "" : current));
  }

  function clearConversation() {
    chat.endConversation();
    setDraft("");
    setUnread(false);
    followingMessages.current = true;
    setClearAction(null);
  }

  const inviteActions = (
    <div className={styles.newChatActions}>
      <button
        className={styles.primaryButton}
        disabled={!connected}
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
        disabled={!state.keyReady}
        aria-expanded={joinOpen}
        onClick={() => setJoinOpen(!joinOpen)}
      >
        Join with a link
      </button>
    </div>
  );

  return (
    <section className={styles.page} aria-labelledby="private-chat-title">
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
        data-chat-active={view === "conversations" && !!state.contact}
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
          {state.keyReady && <nav
            className={styles.viewControls}
            role="tablist"
            aria-label="Chat views"
            onKeyDown={(event) => {
              if (
                ![
                  "ArrowDown",
                  "ArrowUp",
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                ].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "conversations"
                  : event.key === "End"
                    ? "discover"
                    : view === "conversations"
                      ? "discover"
                      : "conversations";
              changeView(next);
              document
                .getElementById(
                  next === "discover" ? "discover-tab" : "conversation-tab",
                )
                ?.focus();
            }}
          >
            <button
              id="conversation-tab"
              role="tab"
              tabIndex={view === "conversations" ? 0 : -1}
              aria-label="Conversations"
              aria-selected={view === "conversations"}
              aria-controls="chat-panel"
              onClick={() => changeView("conversations")}
            >
              <ChatIcon />
              <span>
                <strong>Chat</strong>
                <small>{state.contact?.alias || "One to one"}</small>
              </span>
              {state.requests.length > 0 && (
                <span className={styles.count}>{state.requests.length}</span>
              )}
            </button>
            <button
              id="discover-tab"
              role="tab"
              tabIndex={view === "discover" ? 0 : -1}
              aria-label="Discover"
              aria-selected={view === "discover"}
              aria-controls="chat-panel"
              onClick={() => changeView("discover")}
            >
              <IconUsers />
              <span>
                <strong>Discover</strong>
                <small>
                  {state.room ? "People in your room" : "Invite-only room"}
                </small>
              </span>
              {state.room && (
                <span
                  className={styles.roomIndicator}
                  title="In a private room"
                />
              )}
            </button>
          </nav>}
          {state.room && <section
            className={styles.availabilityCard}
            data-available={state.availableUntil !== null}
            aria-labelledby="availability-title"
          >
            <div className={styles.availabilityHeading}>
              <div>
                <h2 id="availability-title">Available to chat</h2>
                <span className={styles.availabilityState}>
                  {state.presence === "online" && state.availableUntil
                    ? `Listed · ${timeLeft(state.availableUntil, now)}`
                    : state.presence === "publishing"
                      ? "Joining Discover…"
                      : state.presence === "error"
                        ? "Unavailable"
                        : "Off · not listed"}
                </span>
              </div>
              <button
                type="button"
                className={styles.switch}
                role="switch"
                aria-label="Available to chat"
                aria-checked={
                  state.availableUntil !== null ||
                  state.presence === "publishing"
                }
                disabled={!connected || !!state.contact || !state.room}
                onClick={() =>
                  chat.setAvailable(
                    state.availableUntil === null &&
                      state.presence !== "publishing",
                  )
                }
              >
                <span />
              </button>
            </div>
            <p className={styles.fieldHint}>
              {state.room
                ? "Room only · off revokes your invite."
                : "Join a room to appear."}
            </p>
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
          {!gettingStarted && !(view === "conversations" && state.contact) && (
            <header className={styles.paneHeading}>
              <span>
                {view === "discover" ? <IconUsers /> : <ChatIcon />}
                {view === "discover" ? "People in your room" : "Direct messages"}
              </span>
              <span className={styles.paneMeta}>
                <IconShield />
                {view === "discover" ? "Invite-only" : "End-to-end encrypted"}
              </span>
            </header>
          )}
          <div
            id="chat-panel"
            role={gettingStarted ? "region" : "tabpanel"}
            aria-labelledby={
              gettingStarted ? "onboarding-title" : view === "discover" ? "discover-tab" : "conversation-tab"
            }
            className={styles.panel}
            data-chat={view === "conversations" && !!state.contact}
          >
            {state.requests.map((item) => (
              <section
                key={item.packet.id}
                className={styles.requestCard}
                aria-label={`Chat request from ${item.packet.alias}`}
              >
                <span className={styles.avatar}>
                  {item.packet.alias.slice(0, 1)}
                </span>
                <div className={styles.requestInfo}>
                  <h3>{item.packet.alias}</h3>
                  <p>Wants to chat with you</p>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => void chat.rejectRequest(item.packet.id)}
                  >
                    Decline
                  </button>
                  <button
                    className={styles.primaryButton}
                    disabled={acceptingId !== null}
                    onClick={async () => {
                      setAcceptingId(item.packet.id);
                      changeView("conversations");
                      try {
                        await chat.acceptRequest(item.packet.id);
                      } finally {
                        setAcceptingId(null);
                      }
                    }}
                  >
                    {acceptingId === item.packet.id ? "Accepting…" : "Accept"}
                  </button>
                </div>
              </section>
            ))}
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
                {(roomFromLink || inviteFromLink) && <span className={styles.invitationBadge}><LinkIcon />{roomFromLink ? "Room invitation received" : "Chat invitation received"}</span>}
                <h2 id="onboarding-title">{!state.keyReady ? "Start with your alias." : connecting ? "Making a private connection…" : "Connect. Then say hello."}</h2>
                <p>{!state.keyReady ? "Choose an alias to get started. Your messages stay in this tab." : connecting ? "Waiting for a signal to return through Nym. This can take a moment." : "Switch on Nym to continue. Your presence stays hidden until you choose to share it."}</p>
                {state.keyReady && <button className={styles.primaryButton} disabled={state.link === "offline" && !state.connectionWanted} onClick={state.connectionWanted ? chat.disconnect : chat.reconnect}>
                  <PowerIcon />{state.connectionWanted ? "Cancel connection" : state.link === "failed" ? "Try again" : "Connect to Nym"}
                </button>}
                <span className={styles.onboardingFoot}><IconShield />End-to-end encrypted · One to one</span>
              </div>
            ) : view === "discover" ? (
              <>
                {!state.room ? (
                  <div className={styles.roomWelcome}>
                    <span className={styles.roomMark}>
                      <IconPrivateChat />
                    </span>
                    <div>
                      <h2>{roomFromLink ? "Your room is ready to join" : "Find your people"}</h2>
                      <p>{roomFromLink ? "Enter to find people. You stay unlisted unless you turn on availability." : "Share a room link to find people, then chat one to one."}</p>
                    </div>
                    {roomFromLink ? <>
                      <button className={styles.primaryButton} disabled={!connected || roomBusy} onClick={() => void joinRoom(roomInput)}>{roomBusy ? "Opening room…" : "Join room"}</button>
                      <button className={styles.textButton} onClick={() => { setRoomFromLink(false); setRoomDraft(""); }}>Use another link</button>
                    </> : <>
                    {process.env.NEXT_PUBLIC_PRIVATE_CHAT_PILOT !== "true" && <button
                      className={styles.primaryButton}
                      disabled={roomBusy}
                      onClick={() => void joinRoom()}
                    >
                      {roomBusy ? "Opening room…" : "Create private room"}
                    </button>}
                    <form
                      className={styles.roomJoin}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void joinRoom(roomInput);
                      }}
                    >
                      <label htmlFor="room-link">
                        Already have a room link?
                      </label>
                      <div>
                        <input
                          id="room-link"
                          value={roomInput}
                          onChange={(event) => setRoomDraft(event.target.value)}
                          placeholder="Paste a private room link"
                          maxLength={2048}
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <button
                          className={styles.secondaryButton}
                          disabled={!roomInput.trim() || roomBusy}
                        >
                          Join room
                        </button>
                      </div>
                    </form>
                    </>}
                    <p className={styles.roomBoundary}>
                      Anyone with the link can enter.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className={styles.roomBanner}>
                      <span className={styles.roomMark}>
                        <IconPrivateChat />
                      </span>
                      <div>
                        <h2>Private room</h2>
                        <p>Find people here · talk to one person at a time</p>
                      </div>
                      <div className={styles.roomActions}>
                        <button
                          className={styles.secondaryButton}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                roomUrl(origin, state.room!.token),
                              );
                              setRoomCopied(true);
                            } catch {
                              chat.setNote(
                                "Copy the room link from the field below.",
                              );
                            }
                          }}
                        >
                          {roomCopied ? "Link copied" : "Copy room link"}
                        </button>
                        <button
                          className={styles.textButton}
                          onClick={() => {
                            chat.leaveRoom();
                            setRoomCopied(false);
                          }}
                        >
                          Leave room
                        </button>
                      </div>
                    </div>
                    <details className={styles.roomLinkDetails}>
                      <summary>Room link</summary>
                      <input
                        aria-label="Private room link"
                        readOnly
                        value={roomUrl(origin, state.room.token)}
                        onFocus={(event) => event.target.select()}
                      />
                      <p>
                        Share with people you trust. Anyone with the link can
                        forward access.
                      </p>
                    </details>
                    <div className={styles.discoveryHeading}>
                      <div>
                        <h2>
                          People available in this room{" "}
                          <span>
                            {state.directory === "ready"
                              ? state.peers.length
                              : "—"}
                          </span>
                        </h2>
                        <p>Members appear when they turn on availability · via Nym</p>
                      </div>
                      <button
                        className={styles.textButton}
                        disabled={!connected || state.directory === "loading"}
                        onClick={() => void chat.loadDirectory()}
                      >
                        Refresh
                      </button>
                    </div>
                    {!connected ? (
                      <div className={styles.emptyState}>
                        <IconShield />
                        <h3>Discover paused</h3>
                        <p>
                          Connect to Nym to find people. No direct connection.
                        </p>
                      </div>
                    ) : state.directory === "error" ? (
                      <div className={styles.emptyState}>
                        <IconUsers />
                        <h3>Room unavailable</h3>
                        <p>Refresh to retry through Nym.</p>
                      </div>
                    ) : state.peers.length ? (
                      <ul className={styles.people} aria-label="People online">
                        {state.peers.map((person) => (
                          <li key={person.publicKey}>
                            <span className={styles.avatar}>
                              {person.alias.slice(0, 1)}
                            </span>
                            <div className={styles.personInfo}>
                              <h3>{person.alias}</h3>
                              <p>
                                <span className={styles.onlineDot} />
                                Available to chat
                              </p>
                            </div>
                            <button
                              className={styles.secondaryButton}
                              disabled={
                                !connected || !!state.contact || requestBusy
                              }
                              onClick={() => void request(inviteToken(person))}
                            >
                              Request chat
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className={styles.emptyState}>
                        <IconUsers />
                        <h3>
                          {state.directory === "loading"
                            ? "Finding people…"
                            : "Waiting for your people"}
                        </h3>
                        <p>Share the room link. Members appear when available.</p>
                      </div>
                    )}
                    <p className={styles.directoryNote}>
                      Aliases are not verified identities.
                    </p>
                  </>
                )}
              </>
            ) : state.contact ? (
              <>
                <header className={styles.contactCard}>
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
                    onClick={() => setClearAction("conversation")}
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
                      onScroll={(event) => {
                        const element = event.currentTarget;
                        followingMessages.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
                        if (followingMessages.current) setUnread(false);
                      }}
                    >
                      {state.lines.map((line, index) => (
                        <li
                          key={line.id}
                          className={styles.message}
                          data-direction={line.direction}
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
                        value={draft}
                        onChange={setDraft}
                        onSend={send}
                        enabled={!!canSend}
                        sending={state.sending}
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
                    <p>Invite someone. Talk one to one.</p>
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
                      <p>One invite · one conversation</p>
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
                    {inviteFromLink ? <div className={styles.receivedInvite}><span className={styles.roomMark}><LinkIcon /></span><h2>You received a chat invite</h2><p>Send a request. The other person chooses whether to accept.</p></div> : <>
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
                    <button
                      className={styles.primaryButton}
                      disabled={!connected || !join.trim() || requestBusy}
                    >
                      {requestBusy ? "Checking…" : "Request chat"}
                    </button>
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
      {clearAction && <ChatConfirm
        title={clearAction === "conversation" ? state.contact?.status === "ended" ? "Start a new conversation?" : "End this conversation?" : "Leave this session?"}
        description={clearAction === "conversation" ? "Messages in this conversation will be cleared from this tab. Your alias and room stay available." : "Your alias, invites and messages will be cleared from this tab. You cannot restore them here."}
        action={clearAction === "conversation" ? state.contact?.status === "ended" ? "New conversation" : "End & clear chat" : clearAction === "identity" ? "Start a new identity" : "Leave & clear"}
        onCancel={() => setClearAction(null)}
        onConfirm={clearAction === "conversation" ? clearConversation : leave}
      />}
    </section>
  );
}
