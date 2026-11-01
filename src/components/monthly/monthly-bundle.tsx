"use client";

/* eslint-disable @next/next/no-img-element -- Small same-origin brand mark. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { MonthlyReader, type MonthlyReaderHandle } from "./monthly-reader";
import { editionLabel, type MonthlyEdition, type MonthlyReadingSet } from "@/lib/monthly/catalog";
import { publicationTarget, publicationView, type PublicationView } from "@/lib/monthly/reading-set";
import { monthlySourceCsv } from "@/lib/monthly/source-csv";
import { PHONE_QUERY } from "@/lib/monthly/full-screen";
import { sourceUrl } from "@/lib/monthly/reader";
import styles from "./monthly-bundle-preview.module.css";

type View = PublicationView;
type Register = "sources" | "communities" | "requests" | "zcg";
type Entry = { name: string; detail: string; url: string; amount?: number | null; amountLabel?: string };
function Symbol({name}: {name: View | "download" | "expand" | "collapse" | "back" | "left" | "right" | "search" | "external"}) {
  const paths = {
    monthly:<><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15"/></>,
    operations:<><path d="M8 5h12M8 12h12M8 19h12"/><circle cx="4" cy="5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="19" r="1"/></>,
    sources:<><path d="M5 3h12l3 3v15H5V3ZM9 8h6M9 12h7M9 16h7"/></>,
    download:<><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></>,
    expand:<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,
    collapse:<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5"/>,
    back:<path d="M19 12H5m6-6-6 6 6 6"/>,
    left:<path d="m14 6-6 6 6 6"/>, right:<path d="m10 6 6 6-6 6"/>,
    search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    external:<path d="M14 3h7v7m0-7L10 14M10 5H4v15h15v-6"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function SourcesPanel({data}: {data: MonthlyReadingSet}) {
  const [register, setRegister] = useState<Register>("sources");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const rowsBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.max(1, Math.min(8, Math.floor(entry.contentRect.height / 66)));
      setPageSize(next); setPage(0);
    });
    if (rowsBox.current) observer.observe(rowsBox.current);
    return () => observer.disconnect();
  }, []);
  const all: Entry[] = data[register];
  const matches = all.filter(e => `${e.name} ${e.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const maxPage = Math.max(0,Math.ceil(matches.length/pageSize)-1);
  const currentPage = Math.min(page,maxPage);
  const visible = matches.slice(currentPage*pageSize,(currentPage+1)*pageSize);
  const labels = {sources:"Source index",communities:"Community coverage",requests:"Coinholder requests",zcg:"ZCG proposals and decisions"};
  const registerNames = {sources:"Sources",communities:"Communities",requests:"Coinholder",zcg:"ZCG"};
  function exportCsv() {
    const csv = monthlySourceCsv(matches);
    const url = URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a");link.href=url;link.download=`OpenZcash-${data.id}-${register}.csv`;link.click();URL.revokeObjectURL(url);
  }
  return <section className={styles.dataPanel} aria-label="Sources and data explorer">
    <div className={styles.dataHeading}>
      <div><span className={styles.eyebrow}>THE EVIDENCE BEHIND THE ISSUE</span><h1>Go deeper.</h1><p>Reporting period: {data.documents.monthly.periodStart} to {data.evidenceCutoff}.{data.reviewedAt ? ` Reviewed ${data.reviewedAt}.` : ""}</p></div>
      <button className={styles.export} onClick={exportCsv}><Symbol name="download"/>Export CSV</button>
    </div>
    <div className={styles.filters}>
      <div className={styles.registers} aria-label="Choose a register">
        {(["sources","zcg","requests","communities"] as Register[]).map(id=><button key={id} aria-pressed={register===id} onClick={()=>{setRegister(id);setPage(0);setQuery("");}}>{registerNames[id]}<span>{data[id].length}</span></button>)}
      </div>
      <label className={styles.search}><Symbol name="search"/><input aria-label="Search this register" placeholder="Search this register" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>{query&&<button onClick={()=>{setQuery("");setPage(0);}} aria-label="Clear search">×</button>}</label>
    </div>
    <div className={styles.registerHeading}><strong>{labels[register]}</strong><span>{register==="requests"?"Requested funding · Outcome stated in each record":register==="zcg"?"Request amounts · Status stated in each record":"Original sources and dated reports"}</span></div>
    <div ref={rowsBox} className={styles.rows} role="list" aria-label={labels[register]}>
      {visible.map(e=><a key={e.url+e.name} className={styles.row} href={sourceUrl(e.url)||undefined} target="_blank" rel="noopener noreferrer" role="listitem" title={`${e.name} — ${e.detail}`}><div><strong>{e.name}</strong><span>{e.detail}</span></div>{(e.amountLabel||e.amount!=null)&&<b>{e.amountLabel||new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(e.amount!)}</b>}<Symbol name="external"/></a>)}
      {!visible.length&&<div className={styles.empty}><Symbol name="search"/><strong>No matches in this register.</strong><button onClick={()=>setQuery("")}>Clear search</button></div>}
    </div>
    <div className={styles.dataFooter}><span>{matches.length?`${currentPage*pageSize+1}–${Math.min((currentPage+1)*pageSize,matches.length)} of ${matches.length}`:"0 results"}</span><div><button aria-label="Previous results" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><Symbol name="left"/></button><span>{currentPage+1} / {maxPage+1}</span><button aria-label="Next results" disabled={currentPage===maxPage} onClick={()=>setPage(currentPage+1)}><Symbol name="right"/></button></div></div>
  </section>;
}

export function MonthlyBundle({initialView, data, editions, preview=false, basePath=`/monthly/${data.id}`}:
  {initialView:View; data:MonthlyReadingSet; editions:MonthlyEdition[]; preview?:boolean; basePath?:string}) {
  const docs = data.documents;
  const tabs: {id:View; name:string; count:number; unit:string}[] = [
    {id:"monthly",name:"Monthly",count:docs.monthly.pageCount,unit:"pages"},
    {id:"operations",name:"Operations",count:docs.operations.pageCount,unit:"pages"},
    {id:"sources",name:"Sources & Data",count:data.sources.length,unit:"sources"},
  ];
  const [view,setView]=useState<View>(initialView);
  const [fullScreen,setFullScreen]=useState(false);
  const [nativeFullScreen,setNativeFullScreen]=useState(true);
  const root=useRef<HTMLDivElement>(null);
  const reader=useRef<MonthlyReaderHandle>(null);
  const expandButton=useRef<HTMLButtonElement>(null);
  const reading=useRef(false);
  const noteReading=useCallback((on:boolean)=>{reading.current=on;},[]);
  const positions=useRef<Record<string,string>>({monthly:"#1",operations:"#1"});
  const tabButtons=useRef<Array<HTMLButtonElement|null>>([]);
  useEffect(()=>{
    const sync=()=>setView(publicationView(new URLSearchParams(location.search).get("publication")));
    // While a page is open in full screen the browser's full screen belongs to the reader, not to this button.
    const fullscreen=()=>setFullScreen(document.fullscreenElement===root.current&&!reading.current);
    setNativeFullScreen(typeof root.current?.requestFullscreen==="function");
    window.addEventListener("popstate",sync);document.addEventListener("fullscreenchange",fullscreen);
    return()=>{window.removeEventListener("popstate",sync);document.removeEventListener("fullscreenchange",fullscreen);};
  },[]);
  // A report link can swap the publication under a page open in full screen: the new one opens the same way.
  useLayoutEffect(()=>{
    if(!reading.current)return;
    if(view!=="sources"){reader.current?.enterFullScreen(expandButton.current);return;}
    reading.current=false;
    setFullScreen(document.fullscreenElement===root.current);
  },[view]);
  function changeView(next:View,page?:number) {
    if(next===view&&page===undefined)return;
    if(view!=="sources")positions.current[view]=window.location.hash||"#1";
    if(page!==undefined&&next!=="sources")positions.current[next]=`#${Math.min(docs[next].pageCount,Math.max(1,page))}`;
    window.history.replaceState(null,"",`${basePath}?publication=${next}${next==="sources"?"":positions.current[next]}`);
    setView(next);
  }
  function followReportLink(href:string) {
    const target=publicationTarget(href,basePath,window.location.origin);
    if(!target)return false;
    changeView(target.view,target.page);
    return true;
  }
  async function expand(event:React.MouseEvent<HTMLButtonElement>) {
    // Phones open the page itself in the reader's full screen, which needs no Fullscreen API.
    if(view!=="sources"&&!document.fullscreenElement&&window.matchMedia(PHONE_QUERY).matches){reader.current?.enterFullScreen(event.currentTarget);return;}
    try { if(document.fullscreenElement)await document.exitFullscreen();else await root.current?.requestFullscreen(); } catch { /* Browser may restrict fullscreen; the fitted reader remains usable. */ }
  }
  return <div ref={root} className={styles.preview} data-publication={view} data-native-full-screen={nativeFullScreen}>
    <header className={styles.header}>
      <Link href="/" prefetch={false} className={styles.brand} aria-label="Back to OpenZcash" title="Back to OpenZcash">
        <Symbol name="back"/><img src="/logos/marks/openzcash.png" alt="" width="28" height="28"/><strong>OpenZcash</strong>
      </Link>
      <div className={styles.edition}>
        <label className={styles.month}>
          <span>Edition</span>
          <select aria-label="Publication edition" value={data.id} onChange={e=>{window.location.href=`/monthly/${e.target.value}?publication=${view}`;}}>
            {editions.map(edition=><option key={edition.id} value={edition.id}>{editionLabel(edition)}</option>)}
          </select>
        </label>
        {docs.monthly.kind==="period"&&<small className={styles.periodBadge}>Partial period</small>}
      </div>
      <div className={styles.actions}>
        {preview&&<span className={styles.previewBadge}>Layout preview</span>}
        <button ref={expandButton} onClick={expand} aria-label={fullScreen?"Exit full screen":"Enter full screen"} title={fullScreen?"Exit full screen":"Full screen"}><Symbol name={fullScreen?"collapse":"expand"}/><span>{fullScreen?"Exit full screen":"Full screen"}</span></button>
        {view!=="sources"&&<a href={docs[view].pdf} download className={styles.download} aria-label={`Download ${view==="monthly"?"Monthly":"Operations"} PDF`}><Symbol name="download"/><span>Download PDF</span></a>}
      </div>
    </header>
    <nav className={styles.tabBar} aria-label="Publications for this month">
      <div role="tablist" aria-label="Choose what to read" className={styles.tabs}>{tabs.map((t,i)=><button key={t.id} ref={el=>{tabButtons.current[i]=el;}} role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={view===t.id} aria-label={`${t.name}, ${t.count} ${t.unit}`} tabIndex={view===t.id?0:-1} className={styles.tab} onClick={()=>changeView(t.id)} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const j=e.key==="Home"?0:e.key==="End"?tabs.length-1:(i+(e.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;changeView(tabs[j].id);tabButtons.current[j]?.focus();}}}><Symbol name={t.id}/><span>{t.name}</span><small>{t.count}<span className={styles.countUnit}> {t.unit}</span></small></button>)}</div>
      <span className={styles.tabContext}>{view==="monthly"?"Teams & products":view==="operations"?"Funding, votes & communities":"The complete record"}</span>
    </nav>
    <div className={styles.panel} role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`}>{view==="sources"?<SourcesPanel data={data}/>:<MonthlyReader key={view} handle={reader} editions={[docs[view]]} edition={docs[view]} embedded publicationName={view==="monthly"?"Monthly":"Operations"} baseHref={`${basePath}?publication=${view}`} onFollowLink={followReportLink} fullScreenOpener={expandButton} fullScreenHost={root} onFullScreenChange={noteReading}/>}</div>
  </div>;
}
