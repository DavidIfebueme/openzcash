/** Compile reviewed public source files into a local search index. No network or execution of page code. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Explicit allowlist: never scan private routes, env files, admin modules or the repository broadly.
export const routes = [
  "/", "/zcg", "/zcg/methodology", "/zcg/grants", "/zcg/disbursements", "/zcg/recipients",
  "/zcg/proposals", "/zcg/schedule", "/zcg/committee", "/zcg/meetings", "/zcg/office",
  "/zcg/decisions", "/zcg/totals", "/zcg/analytics", "/zcg/reconciliation", "/zcg/budget",
  "/zcg/stipends", "/zcg/investments", "/zcg/fpf", "/zcg/coinholder", "/zcg/coinholder/votes",
  "/zcg/coinholder/pool", "/zcg/treasury-calculator", "/funding-history", "/governance",
  "/zec-observatory", "/ecosystem", "/wallets", "/development", "/defi", "/z3", "/news",
  "/monthly", "/lockbox", "/zf", "/zodl", "/shielded-labs", "/zakura", "/tachyon",
  "/zechub", "/arborist", "/communities", "/ceremony", "/ceremony/people", "/ceremony/road",
  "/ceremony/record", "/ceremony/ten-years", "/ceremony/watch",
];
const references = [
  ["src/lib/ceremony/story.ts", "/ceremony/road"],
  ["src/lib/ceremony/people.ts", "/ceremony/people"],
  ["src/lib/ceremony/record.ts", "/ceremony/record"],
  ["src/lib/ceremony/films.ts", "/ceremony/watch"],
  ["src/data/governance/record.json", "/governance"],
  ["src/lib/monthly/reading-sets.json", "/monthly"],
];
const textFields = new Set(["title", "subtitle", "description", "what", "label", "name", "detail", "text", "note", "body", "summary", "contents", "licence", "role", "outcome", "decidedBy", "status", "date", "evidenceCutoff", "reviewedAt"]);
const decode = (s) => s.replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
export function publicText(source, filename, reference = false) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, filename.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const parts = [];
  function visit(node) {
    if (ts.isJsxText(node)) { const text=decode(node.text); if(text) parts.push(text); }
    if (ts.isStringLiteralLike(node)) {
      const p = node.parent;
      const field = (ts.isPropertyAssignment(p) || ts.isJsxAttribute(p)) ? p.name.getText(ast).replace(/["']/g, "") : "";
      if ((textFields.has(field) || (ts.isJsxExpression(p) && p.expression === node) || (reference && ts.isArrayLiteralExpression(p))) && !/^(?:https?:|\/|#)/.test(node.text)) {
        const text=decode(node.text); if(text) parts.push(text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...new Set(parts)].join("\n");
}
export function compile() {
  const files = [...routes.map((route) => [`src/app${route === "/" ? "" : route}/page.tsx`, route, false]), ...references.map(([file, route]) => [file, route, true])];
  const docs = [];
  const hash=createHash("sha256");
  for (const [file, route, reference] of files) {
    const source=fs.readFileSync(path.join(root,file),"utf8");
    hash.update(file).update(source);
    let text;
    if (file.endsWith(".json")) {
      const strings=[];
      function read(value, key="") {
        if (typeof value === "string" && textFields.has(key)) strings.push(`${key}: ${decode(value)}`);
        else if (Array.isArray(value)) value.forEach((v)=>read(v,key));
        else if (value && typeof value === "object") for(const [k,v] of Object.entries(value)) read(v,k);
      }
      read(JSON.parse(source)); text=strings.join("\n");
    } else text=publicText(source,file,reference);
    if (!text) continue;
    const paragraphs=text.split("\n"); let chunk="", index=0;
    const flush=()=>{if(chunk.trim()) docs.push({id:`${file}:${index++}`,url:`https://openzcash.org${route}`,title:route === "/" ? "OpenZcash" : route.split("/").filter(Boolean).join(" · ").replaceAll("-"," "),text:chunk.trim()}); chunk="";};
    for(const paragraph of paragraphs) {
      if(chunk.length+paragraph.length>1400) flush();
      for(let i=0;i<paragraph.length;i+=1400){if(i)flush(); chunk+=`${paragraph.slice(i,i+1400)}\n`;}
    }
    flush();
  }
  return {version:1,sourceRevision:hash.digest("hex").slice(0,16),sourceFiles:files.length,documents:docs};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target=path.join(root,"src/lib/zarvis/public-content.json");
  const value=JSON.stringify(compile(),null,2)+"\n";
  if(process.argv.includes("--check")) {
    if(!fs.existsSync(target)||fs.readFileSync(target,"utf8")!==value) {console.error("Zarvis public knowledge index needs rebuilding.");process.exitCode=1;}
  } else {fs.writeFileSync(target,value);console.log("Zarvis public knowledge index updated.");}
}
