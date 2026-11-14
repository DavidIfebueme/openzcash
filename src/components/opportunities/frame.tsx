"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BASE, type Catalog } from "./catalog";
import { Icon } from "./visuals";
import { retainOrder } from "./order";

const CatalogContext = createContext<Catalog | null>(null);
export function useCatalog(incoming?: Catalog) {
  const value = useContext(CatalogContext);
  if (!value) throw new Error("Missing opportunity catalog");
  return incoming ? { ...incoming, items: retainOrder(incoming.items, value.items.map((item) => item.id)) } : value;
}
export function Dialog({ open, onClose, title, children, className = "" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const overflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { if (dialog.open) dialog.close(); document.body.style.overflow = overflow; };
  }, [open]);
  return <dialog ref={ref} className={"op-dialog " + className} aria-label={title}
    onCancel={(e) => { e.preventDefault(); onClose(); }}
    onClick={(e) => { if (e.target !== ref.current) return; const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); }}>
    <div className="dialog-head"><h2>{title}</h2><button type="button" className="rd-icon-button" onClick={onClose} aria-label={"Close " + title}><Icon name="close" /></button></div>
    <div className="dialog-body">{children}</div>
  </dialog>;
}
export function OpportunitiesLayout({ children, catalog }: { children: ReactNode; catalog: Catalog }) {
  const path = usePathname();
  const router = useRouter();
  const [order] = useState(() => catalog.items.map((item) => item.id));
  const current = useMemo(() => ({ ...catalog, items: retainOrder(catalog.items, order) }), [catalog, order]);
  useEffect(() => {
    if (path !== BASE && !path.startsWith(BASE + "/tasks/")) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, router]);
  return <CatalogContext.Provider value={current}>
    <section className="opportunities-beta opportunity-directory" aria-label="Opportunities">
      <div className="op-content"><div className="op-page">
        <div className="op-appbar op-workspace-bar"><div className="op-workspace-bar-inner">
          <nav aria-label="Opportunities sections">
            {[[BASE, "Explore"], [BASE + "/platforms", "Platforms"], [BASE + "/art", "Art library"]].map(([href, label]) => <Link key={href} href={href} aria-current={(href === BASE ? path === BASE || path.startsWith(BASE + "/tasks/") : path === href) ? "page" : undefined}>{label}</Link>)}
          </nav>
          <Link href={BASE + "/prepare"} className="op-button primary op-new-opportunity"><Icon name="pen" size={16} /><span>Prepare activity</span></Link>
        </div></div>
        {children}
        <footer className="directory-footer"><span>Discover here. Participate at the source.</span><Link href={BASE + "/platforms"}>How it works <Icon name="arrow" size={14} /></Link></footer>
      </div></div>
    </section>
  </CatalogContext.Provider>;
}
