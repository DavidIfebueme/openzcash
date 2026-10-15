"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { IconClose, IconSearch } from "@/components/icons";
import { SmileIcon, SendIcon } from "./chat-ui-icons";
import styles from "./private-chat.module.css";
const EMOJIS = [
  ["😊", "Smile", "Faces"],
  ["😂", "Laugh", "Faces"],
  ["🥰", "Love", "Faces"],
  ["😎", "Cool", "Faces"],
  ["🤔", "Thinking", "Faces"],
  ["😉", "Wink", "Faces"],
  ["😁", "Grin", "Faces"],
  ["🥳", "Celebrate", "Faces"],
  ["😅", "Relieved", "Faces"],
  ["😍", "Heart eyes", "Faces"],
  ["😮", "Surprised", "Faces"],
  ["😴", "Sleepy", "Faces"],
  ["🥲", "Happy tear", "Faces"],
  ["😭", "Crying", "Faces"],
  ["🫡", "Salute", "Faces"],
  ["🤗", "Hug", "Faces"],
  ["👋", "Wave", "Gestures"],
  ["👍", "Thumbs up", "Gestures"],
  ["👎", "Thumbs down", "Gestures"],
  ["👏", "Clap", "Gestures"],
  ["🙌", "Raised hands", "Gestures"],
  ["🙏", "Thanks", "Gestures"],
  ["🤝", "Handshake", "Gestures"],
  ["💪", "Strong", "Gestures"],
  ["✌️", "Peace", "Gestures"],
  ["🤞", "Fingers crossed", "Gestures"],
  ["👌", "OK", "Gestures"],
  ["🫶", "Heart hands", "Gestures"],
  ["❤️", "Red heart", "Things"],
  ["💛", "Yellow heart", "Things"],
  ["🔥", "Fire", "Things"],
  ["🚀", "Rocket", "Things"],
  ["✨", "Sparkles", "Things"],
  ["🎉", "Party", "Things"],
  ["🔒", "Lock", "Things"],
  ["🛡️", "Shield", "Things"],
  ["🦓", "Zebra", "Things"],
  ["🌱", "Seedling", "Things"],
  ["☕", "Coffee", "Things"],
  ["💡", "Idea", "Things"],
  ["✅", "Check", "Things"],
  ["👀", "Eyes", "Things"],
  ["💯", "Hundred", "Things"],
  ["🌍", "World", "Things"],
] as const;
export function ChatComposer({
  value,
  onChange,
  onSend,
  enabled,
  sending,
}: {
  value: string;
  onChange(value: string): void;
  onSend(event: FormEvent): void;
  enabled: boolean;
  sending: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Faces");
  const textarea = useRef<HTMLTextAreaElement>(null),
    search = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    picker = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState({
    start: value.length,
    end: value.length,
  });
  const isOpen = open && enabled;
  useEffect(() => {
    if (!isOpen) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (
        !picker.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [isOpen]);
  useEffect(() => {
    const input = textarea.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 128)}px`;
    }
  }, [value]);
  const start = Math.min(selection.start, value.length),
    end = Math.min(selection.end, value.length);
  const choose = (emoji: string) => {
    if (!enabled || value.length - (end - start) + emoji.length > 400) return;
    const next = value.slice(0, start) + emoji + value.slice(end),
      caret = start + emoji.length;
    onChange(next);
    setOpen(false);
    setSelection({ start: caret, end: caret });
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(caret, caret);
    });
  };
  const results = EMOJIS.filter(([, name, group]) =>
    query.trim()
      ? name.toLowerCase().includes(query.trim().toLowerCase())
      : group === category,
  );
  return (
    <form className={styles.composer} onSubmit={onSend}>
      {isOpen && (
        <div
          className={styles.emojiPicker}
          ref={picker}
          role="dialog"
          aria-label="Choose an emoji"
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              event.target instanceof HTMLInputElement
            )
              event.preventDefault();
            if (event.key === "Escape") {
              event.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <div className={styles.emojiHeading}>
            <strong>Emoji</strong>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Close emoji picker"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <IconClose />
            </button>
          </div>
          <label className={`ws-field ${styles.emojiSearch}`}>
            <IconSearch />
            <input
              ref={search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search emoji"
              placeholder="Search emoji"
              autoComplete="off"
            />
          </label>
          <div className={styles.emojiTabs} aria-label="Emoji categories">
            {["Faces", "Gestures", "Things"].map((group) => (
              <button
                type="button"
                key={group}
                aria-pressed={!query && category === group}
                onClick={() => {
                  setCategory(group);
                  setQuery("");
                }}
              >
                {group}
              </button>
            ))}
          </div>
          <div className={styles.emojiGrid}>
            {results.map(([emoji, name]) => (
              <button
                type="button"
                key={name}
                title={name}
                aria-label={name}
                disabled={value.length - (end - start) + emoji.length > 400}
                onClick={() => choose(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          {!results.length && (
            <p className={styles.emojiEmpty}>No matching emoji.</p>
          )}
        </div>
      )}
      <div className={styles.composerBar}>
        <button
          type="button"
          className={styles.iconButton}
          ref={trigger}
          disabled={!enabled}
          title="Emoji"
          aria-label="Choose emoji"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => {
            if (textarea.current)
              setSelection({
                start: textarea.current.selectionStart,
                end: textarea.current.selectionEnd,
              });
            setQuery("");
            setOpen(!isOpen);
          }}
        >
          <SmileIcon />
        </button>
        <label className={styles.srOnly} htmlFor="chat-message">
          Message
        </label>
        <textarea
          ref={textarea}
          id="chat-message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onSelect={(event) => {
            setSelection({
              start: event.currentTarget.selectionStart,
              end: event.currentTarget.selectionEnd,
            });
          }}
          placeholder={enabled ? "Message…" : "Waiting for connection…"}
          maxLength={400}
          disabled={!enabled}
          rows={1}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (enabled && value.trim() && !sending)
                event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          className={styles.sendButton}
          aria-label="Send"
          title="Send message"
          disabled={!enabled || !value.trim() || sending}
        >
          <SendIcon />
        </button>
      </div>
      <div className={styles.composerHint}>
        <span>Enter to send · Shift + Enter for a new line</span>
        <span className={value.length >= 380 ? styles.nearLimit : undefined}>
          {value.length}/400
        </span>
      </div>
    </form>
  );
}
