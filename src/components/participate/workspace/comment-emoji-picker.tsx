"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { insertCommentEmoji } from "./comment-emoji-insertion";
import "./comment-emoji-picker.css";

const EMOJI = [
  ["😊", "Smile"], ["👍", "Thumbs up"], ["🙏", "Thank you"], ["❤️", "Heart"], ["🎉", "Celebrate"], ["🚀", "Rocket"],
  ["👏", "Applause"], ["💡", "Idea"], ["✅", "Check mark"], ["💪", "Strength"], ["🤝", "Handshake"], ["🙌", "Raised hands"],
  ["🎯", "Goal"], ["👀", "Eyes"], ["🤔", "Thinking"], ["💬", "Discussion"], ["🌱", "Growth"], ["🔥", "Fire"],
  ["✨", "Sparkles"], ["🛡️", "Shield"], ["💛", "Yellow heart"], ["🐸", "Frog"], ["🦓", "Zebra"], ["😄", "Grin"],
] as const;

type Props = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  disabled?: boolean;
};

export function CommentEmojiPicker({ textareaRef, value, onChange, maxLength, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const selection = useRef({ start: value.length, end: value.length });
  const id = useId();
  const visible = open && !disabled;

  useEffect(() => {
    if (!visible) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function pointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", pointerDown);
    return () => document.removeEventListener("pointerdown", pointerDown);
  }, [visible]);

  function toggle() {
    const field = textareaRef.current;
    selection.current = { start: field?.selectionStart ?? value.length, end: field?.selectionEnd ?? value.length };
    setNotice("");
    setOpen(current => !current);
  }

  function insert(emoji: string) {
    if (disabled) return;
    const result = insertCommentEmoji(value, emoji, selection.current.start, selection.current.end, maxLength);
    if (!result) {
      setNotice("Your comment is at its limit. Remove some text to add an emoji.");
      return;
    }
    onChange(result.value);
    setOpen(false);
    setNotice("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
      textareaRef.current?.setSelectionRange(result.caret, result.caret);
    });
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const current = buttons.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 }[event.key];
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : offset === undefined ? null : (current + offset + buttons.length) % buttons.length;
    if (next === null) return;
    event.preventDefault();
    buttons[next]?.focus();
  }

  return <div className="dao-comment-emoji" ref={root} onKeyDown={navigate} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button type="button" ref={trigger} className="dao-comment-emoji-trigger" disabled={disabled} aria-expanded={visible} aria-haspopup="dialog" aria-controls={visible ? id : undefined} onClick={toggle}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M8 14a4.5 4.5 0 0 0 8 0" /><path d="M8 8.5h.01M16 8.5h.01" strokeWidth="2.5" strokeLinecap="round" /></svg>
      Emoji
    </button>
    {visible && <div id={id} ref={panel} role="dialog" aria-label="Add an emoji" className="dao-comment-emoji-panel">
      <span className="dao-comment-emoji-heading">Add an emoji</span>
      <div className="dao-comment-emoji-options">
        {EMOJI.map(([emoji, label]) => <button key={emoji} type="button" aria-label={label} title={label} onClick={() => insert(emoji)}>{emoji}</button>)}
      </div>
      {notice && <p role="status" className="dao-comment-emoji-notice">{notice}</p>}
    </div>}
  </div>;
}
