"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./private-chat-confirm.module.css";

export function ChatConfirm({ title, description, action, onConfirm, onCancel }: {
  title: string;
  description: string;
  action: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      <div className={styles.actions}>
        <button type="button" autoFocus onClick={onCancel}>Keep chatting</button>
        <button type="button" className={styles.confirm} onClick={onConfirm}>{action}</button>
      </div>
    </dialog>
  );
}
