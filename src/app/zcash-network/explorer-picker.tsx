"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NETWORK_EXPLORERS } from "@/lib/network/explorers";
import { NetworkIcon } from "./network-icons";
import s from "./explorer-picker.module.css";

export function ExplorerPicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLAnchorElement | null)[]>([]);
  const typeahead = useRef({ text: "", time: 0 });
  const id = useId();
  const listId = `${id}-explorers`;
  const current = selected === null ? null : NETWORK_EXPLORERS[selected];

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) options.current[active]?.click();
      else { setActive(selected ?? 0); setOpen(true); }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setActive(0);
      else if (event.key === "End") setActive(NETWORK_EXPLORERS.length - 1);
      else if (!open) setActive(selected ?? (event.key === "ArrowUp" ? NETWORK_EXPLORERS.length - 1 : 0));
      else setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + NETWORK_EXPLORERS.length) % NETWORK_EXPLORERS.length);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const time = Date.now();
      const text = `${time - typeahead.current.time < 700 ? typeahead.current.text : ""}${event.key}`.toLowerCase();
      typeahead.current = { text, time };
      const index = NETWORK_EXPLORERS.findIndex((explorer) => explorer.name.toLowerCase().startsWith(text));
      if (index !== -1) { event.preventDefault(); setActive(index); setOpen(true); }
    }
  }

  return <div className={s.picker} ref={root}>
    <button ref={trigger} type="button" role="combobox" className={s.trigger}
      aria-label={current ? `Block explorer: ${current.name}` : "Choose a block explorer"}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      onKeyDown={navigate}
      onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false); }}
      onClick={() => { if (!open) setActive(selected ?? 0); setOpen(!open); }}>
      {current ? <Image src={current.logo} alt="" width={20} height={20} className={s.selectedLogo} /> : <NetworkIcon name="explorer" className={s.globe} />}
      <span>{current?.name ?? "Explorers"}</span>
      <NetworkIcon name="chevron" className={s.chevron} data-open={open} />
    </button>
    <div className={s.popover} hidden={!open}>
      <div className={s.intro}>Transactions, addresses & blocks</div>
      <div id={listId} role="listbox" aria-label="Block explorers" className={s.list}>
        {NETWORK_EXPLORERS.map((explorer, index) => <a key={explorer.id} id={`${listId}-${index}`}
          ref={(element) => { options.current[index] = element; }} role="option" aria-selected={selected === index}
          aria-label={`${explorer.name}, ${explorer.domain}, opens in a new tab`}
          tabIndex={-1} href={explorer.url} target="_blank" rel="noopener noreferrer" className={s.option}
          data-active={active === index} onPointerMove={() => setActive(index)}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => { setSelected(index); setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>
          <span className={s.logo}><Image src={explorer.logo} alt="" width={32} height={32} /></span>
          <span className={s.identity}><strong>{explorer.name}</strong><small>{explorer.domain}</small></span>
          <NetworkIcon name="external" className={s.arrow} />
        </a>)}
      </div>
    </div>
  </div>;
}
