// Builds docs/architecture/architecture-map.html from the code.
//
//   node docs/architecture/gen/build.mjs            (from the repo root)
//
// 1. Runs the per-language extractors (Java via javac's parser, Python via ast,
//    TypeScript via each project's own compiler) into a temp folder.
// 2. Links them: HTTP calls to the endpoint that serves them, Kafka producers to topics
//    to consumers, Inngest events to the functions they trigger, code to Postgres tables
//    (parsed from the Flyway migrations), Redis keys, S3 and third-party services, and
//    exceptions to the handler that turns them into a response.
// 3. Adds overlay.json (hand-written: links static analysis can't see, flows, examples).
// 4. Writes graph.json and inlines it into template.html.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.cwd();
const GEN = path.join(REPO, "docs/architecture/gen");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "archmap-"));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: REPO, stdio: ["ignore", "inherit", "inherit"], maxBuffer: 1 << 30 });

const skipExtract = process.argv.includes("--reuse") && fs.existsSync(path.join(GEN, ".cache"));
const SRC = skipExtract ? path.join(GEN, ".cache") : TMP;
const TS_PROJECTS = [
  ["audioApp", "audioApp"], ["audioFrontend", "audioFrontend"], ["adminFrontend", "adminFrontend"],
  ["audioProcessing", "audioProcessing"], ["mailEvents", "workers/mailEvents"], ["util", "util"],
];
if (!skipExtract) {
  run("java", ["--add-exports", "jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED", path.join(GEN, "JavaGraph.java"), path.join(TMP, "java.json"),
    "coreEngine=coreEngine/src/main/java", "streams=streams/src/main/java", "communication=communication/src/main/java", "migration=migration/src/main/java"]);
  run("python3", [path.join(GEN, "py_graph.py"), path.join(TMP, "py.json"), "adminBackend/admin"]);
  for (const [svc, dir] of TS_PROJECTS) run("node", [path.join(GEN, "ts_graph.mjs"), path.join(TMP, `ts-${svc}.json`), svc, dir]);
}
const load = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
const parts = [load("java.json"), load("py.json"), ...TS_PROJECTS.map(([s]) => load(`ts-${s}.json`))];

const nodes = new Map();
let edges = [];
const types = {};
const classes = [];
for (const p of parts) {
  for (const n of p.nodes) nodes.set(n.id, n);
  edges.push(...p.edges);
  Object.assign(types, p.types || {});
  classes.push(...(p.classes || []));
}
const javaConstants = parts[0].constants || {};

// ---------------------------------------------------------------- data stores
const MIG = path.join(REPO, "migration/src/main/resources/db/migration");
const tables = {};
const migFiles = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
for (const f of migFiles) {
  const sql = fs.readFileSync(path.join(MIG, f), "utf8").replace(/--[^\n]*/g, "");
  const version = f.split("__")[0];
  for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+("?[\w.]+"?)\s*\(([\s\S]*?)\);/gi)) {
    const name = m[1].replace(/"/g, "").replace(/^public\./, "").toLowerCase();
    const cols = [];
    for (const line of m[2].split(/,(?![^(]*\))/)) {
      const t = line.trim();
      const cm = t.match(/^"?([a-z_][a-z0-9_]*)"?\s+([A-Za-z]+(?:\s*\([\d, ]+\))?(?:\s+(?:VARYING|PRECISION|WITH(?:OUT)? TIME ZONE))*(?:\[\])?)/i);
      if (cm && !/^(PRIMARY|UNIQUE|CONSTRAINT|FOREIGN|CHECK|EXCLUDE)$/i.test(cm[1])) cols.push([cm[1], cm[2].toLowerCase(), /PRIMARY KEY/i.test(t) ? "pk" : /REFERENCES\s+(\w+)/i.test(t) ? "fk:" + t.match(/REFERENCES\s+(\w+)/i)[1] : ""]);
    }
    const pk = m[2].match(/PRIMARY KEY\s*\(([^)]+)\)/i);
    tables[name] = { cols, since: version, pk: pk ? pk[1].replace(/\s/g, "") : cols.filter((c) => c[2] === "pk").map((c) => c[0]).join(",") };
  }
  for (const m of sql.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+(\w+)\s+([\s\S]*?);/gi)) {
    const t = tables[m[1].toLowerCase()];
    if (!t) continue;
    for (const a of m[2].matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+(\w+)\s+([A-Za-z]+(?:\s*\([\d, ]+\))?)/gi)) {
      if (!t.cols.some((c) => c[0] === a[1])) t.cols.push([a[1], a[2].toLowerCase(), "", version]);
    }
    for (const a of m[2].matchAll(/DROP COLUMN(?: IF EXISTS)?\s+(\w+)/gi)) t.cols = t.cols.filter((c) => c[0] !== a[1]);
  }
  for (const m of sql.matchAll(/DROP TABLE(?: IF EXISTS)?\s+(\w+)/gi)) delete tables[m[1].toLowerCase()];
}
// JPQL uses entity names ("FROM Song s"); map them to tables
const entityTable = {};
for (const c of classes) if (c.table) entityTable[c.name.toLowerCase()] = c.table;

const topicsYaml = fs.readFileSync(path.join(REPO, "infra/kafka/topics.yaml"), "utf8");
const topics = {};
let lastComment = "";
for (const line of topicsYaml.split("\n")) {
  const c = line.match(/^\s*#\s*(.+)/);
  if (c && /^\s{2}#/.test(line)) lastComment = c[1];
  const n = line.match(/- name:\s*([\w.\-]+)(?:\s*#\s*(.*))?/);
  if (n) topics[n[1]] = { group: lastComment, note: n[2] || "", config: "" };
  const cfg = line.match(/config:\s*(.+)/);
  const last = Object.keys(topics).at(-1);
  if (cfg && last) topics[last].config = cfg[1].trim();
}
const lakeTopics = [...fs.readFileSync(path.join(REPO, "infra/lake/connect.yaml"), "utf8").matchAll(/^\s+- ([a-z]+\.[\w.\-]+v\d)$/gm)].map((m) => m[1]);

// ---------------------------------------------------------------- normalise targets
const STORE_LABEL = {
  "ext:recombee": "Recombee (recommendations)", "ext:algolia": "Algolia (search)", "ext:imagekit": "ImageKit (canvas clips, images)",
  "ext:mail": "Mail provider (SES / Resend / SMTP)", "ext:http": "Outbound HTTP", "ext:ffmpeg": "FFmpeg / Shaka (local process)",
  "ext:duckdb": "DuckDB over the S3 lake", "s3:client": "Amazon S3 (SDK client)", "redis:client": "Redis (client)",
  "s3:prod": "S3 production bucket (HLS audio, video, shorts)", "s3:temp": "S3 temp bucket (raw uploads)", "ext:inngest": "Inngest",
};
function normTarget(t) {
  if (t.startsWith("table:")) {
    const name = t.slice(6);
    if (tables[name]) return t;
    if (entityTable[name] && tables[entityTable[name]]) return "table:" + entityTable[name];
    if (tables[name + "s"]) return "table:" + name + "s";
    return null;
  }
  if (t.startsWith("topic:Topics.")) {
    const v = javaConstants[t.slice(6)];
    return v ? "topic:" + v : null;
  }
  if (t.startsWith("redis:")) {
    let k = t.slice(6);
    if (k.startsWith("cache:")) return t;
    if (k === "client") return t;
    k = k.replace(/\{.*$/, "");
    if (k.length < 5 || /^(user_id|user_name)$/.test(k)) return null;
    return "redis:" + k;
  }
  return t;
}
edges = edges.map((e) => ({ ...e, s: normTarget(e.s), t: normTarget(e.t) })).filter((e) => e.s && e.t);

// ---------------------------------------------------------------- HTTP: client call -> endpoint
const endpoints = [...nodes.values()].filter((n) => n.route && n.http && (n.lang === "java" || n.lang === "py"));
const CLIENT_TARGET = { audioApp: "coreEngine", audioFrontend: "coreEngine", adminFrontend: "adminBackend", audioProcessing: "adminBackend", util: null, mailEvents: null };
function clientPath(svc, url, recv) {
  let u = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\{[^}]*(base|url|api|origin|host)[^}]*\}/i, "").replace(/\?.*$/, "").replace(/#.*/, "");
  if (svc === "audioProcessing") {
    const base = { deleteApi: "/webhook/delete", shortApi: "/webhook/short" }[recv] || "/webhook/job";
    if (!u.startsWith("/webhook") && !u.startsWith("/api")) u = base + (u.startsWith("/") ? u : "/" + u);
  }
  if (svc === "audioApp" && !u.startsWith("/api") && !u.startsWith("/auth") && u.startsWith("/")) u = "/api" + u;
  return u.replace(/\/+$/, "") || "/";
}
const segs = (p) => p.split("/").filter(Boolean);
function matchRoute(method, p, preferSvc) {
  const cs = segs(p);
  let best = null;
  for (const ep of endpoints) {
    if (ep.http !== "ANY" && method !== "ANY" && ep.http !== method) continue;
    const rs = segs(ep.route);
    if (rs.length !== cs.length) continue;
    let score = 0, ok = true;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i], c = cs[i];
      if (r === c) score += 3;
      else if (/^\{.*\}$/.test(r) || /^\{.*\}$/.test(c) || /\{/.test(c)) score += 1;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (ep.svc === preferSvc) score += 2;
    if (!best || score > best.score) best = { ep, score };
  }
  return best?.ep;
}
const httpNodes = new Map();
const unmatched = [];
const linked = [];
for (const e of edges) {
  if (e.k !== "httpcall") { linked.push(e); continue; }
  const src = nodes.get(e.s);
  const [method, ...rest] = e.l.split(" ");
  const url = rest.join(" ");
  const p = clientPath(src?.svc, url, e.recv);
  const ep = matchRoute(method, p, CLIENT_TARGET[src?.svc]);
  if (ep) linked.push({ s: e.s, t: ep.id, k: "http", o: e.o, l: `${method} ${p}`, ctx: e.ctx, onFail: e.onFail });
  else {
    const id = "httpx:" + method + " " + p;
    httpNodes.set(id, { id, name: `${method} ${p}`, kind: "http-unresolved", svc: "external", lang: "store" });
    linked.push({ s: e.s, t: id, k: "http", o: e.o, l: `${method} ${url}`, ctx: e.ctx, unresolved: true });
    unmatched.push(`${src?.svc}: ${method} ${url}`);
  }
}
edges = linked;

// ---------------------------------------------------------------- exceptions -> handlers (with inheritance)
const javaSuper = {};
for (const c of classes) if (c.extends) javaSuper[c.name] = c.extends;
const handled = {};
for (const e of edges) if (e.k === "fail" && e.s.startsWith("exception:")) (handled[e.s.slice(10)] ||= []).push(e.t);
const thrown = new Set(edges.filter((e) => e.k === "throws").map((e) => e.t.slice(10)));
for (const ex of thrown) {
  if (handled[ex]) continue;
  for (let p = javaSuper[ex], i = 0; p && i < 6; p = javaSuper[p], i++) {
    if (handled[p]) { for (const h of handled[p]) edges.push({ s: "exception:" + ex, t: h, k: "fail", l: `handled as ${p}` }); break; }
  }
}

// anything a core API endpoint throws without a specific handler ends in handleUncaughtException
const uncaught = [...nodes.values()].find((n) => n.cls === "GlobalExceptionHandler" && n.name === "handleUncaughtException");
if (uncaught) {
  const handledNow = new Set(edges.filter((e) => e.k === "fail" && e.s.startsWith("exception:")).map((e) => e.s));
  const coreThrown = new Set(edges.filter((e) => e.k === "throws" && nodes.get(e.s)?.svc === "coreEngine").map((e) => e.t));
  for (const ex of coreThrown) if (!handledNow.has(ex)) edges.push({ s: ex, t: uncaught.id, k: "fail", l: "500 (no specific handler)" });
}

// ---------------------------------------------------------------- overlay
const overlay = JSON.parse(fs.readFileSync(path.join(GEN, "overlay.json"), "utf8"));
const findId = (ref) => {
  if (nodes.has(ref)) return ref;
  if (!ref.includes("#")) {
    const hit = [...nodes.values()].find((n) => n.id.endsWith("." + ref) || n.id.endsWith(":" + ref));
    return hit?.id;
  }
  // "path/file.ts#name" or "Class#method" shorthand
  const [f, name] = ref.split("#");
  const cands = [...nodes.values()].filter((n) => (n.file === f || n.cls === f || n.file?.endsWith("/" + f) || n.id.includes(f)) && (n.name === name || n.id.endsWith("#" + name) || n.id.endsWith("." + name)));
  return cands[0]?.id;
};
const missing = [];
const resolveRef = (r) => {
  if (/^(table|topic|redis|s3|ext|inngest|exception|springevent|svc|store|lake|httpx):/.test(r)) return r;
  const id = findId(r);
  if (!id) missing.push(r);
  return id;
};
for (const e of overlay.edges || []) {
  const s = resolveRef(e.s), t = resolveRef(e.t);
  if (s && t) edges.push({ ...e, s, t, overlay: true });
}
for (const [ref, ex] of Object.entries(overlay.examples || {})) {
  const id = resolveRef(ref);
  if (id && nodes.has(id)) nodes.get(id).example = ex;
}
const failures = (overlay.failures || []).map((f) => ({ ...f, id: findId(f.handled) }));
const flows = (overlay.flows || []).map((f) => ({
  ...f,
  steps: f.steps.map((st) => ({ ...st, id: st.ref ? resolveRef(st.ref) : undefined })),
}));

// ---------------------------------------------------------------- store nodes
const storeNodes = new Map();
const ensure = (id) => {
  if (nodes.has(id) || storeNodes.has(id) || httpNodes.has(id)) return;
  const [kind, ...r] = id.split(":");
  const name = r.join(":");
  const n = { id, name: STORE_LABEL[id] || name, kind, svc: { table: "postgres", topic: "kafka", redis: "redis", s3: "s3", inngest: "inngest", ext: "external", exception: "errors", springevent: "spring-events", env: "config", lake: "s3", svc: "external", store: "external" }[kind] || "external", lang: "store" };
  if (kind === "table" && tables[name]) Object.assign(n, { cols: tables[name].cols, since: tables[name].since, pk: tables[name].pk });
  if (kind === "topic") Object.assign(n, topics[name] || { config: "(not in topics.yaml)" }, { lake: lakeTopics.includes(name) });
  storeNodes.set(id, n);
};
edges = edges.filter((e) => !(e.k === "env"));
for (const e of edges) { ensure(e.s); ensure(e.t); }
for (const t of Object.keys(tables)) ensure("table:" + t);
for (const t of Object.keys(topics)) ensure("topic:" + t);
// lake writer
for (const t of lakeTopics) edges.push({ s: "topic:" + t, t: "lake:redpanda-connect", k: "kafka", l: "lake-writer reads (Parquet, every 15 min)" });
ensure("lake:redpanda-connect");
storeNodes.get("lake:redpanda-connect").name = "lake-writer (Redpanda Connect → S3 Parquet)";
edges.push({ s: "lake:redpanda-connect", t: "s3:lake", k: "s3", l: "s3://…-lake/events/topic=…/dt=…/*.parquet" });
ensure("s3:lake");
storeNodes.get("s3:lake").name = "S3 data lake (Parquet)";

// drop exact duplicate edges
const seenE = new Set();
edges = edges.filter((e) => {
  const k = `${e.s}|${e.t}|${e.k}|${e.ctx || ""}|${e.l || ""}`;
  if (seenE.has(k)) return false;
  seenE.add(k);
  return true;
});

// ---------------------------------------------------------------- trivial flag & degrees
const outDeg = new Map(), inDeg = new Map();
for (const e of edges) { outDeg.set(e.s, (outDeg.get(e.s) || 0) + 1); inDeg.set(e.t, (inDeg.get(e.t) || 0) + 1); }
for (const n of nodes.values()) {
  if (!n.trivial && !outDeg.get(n.id) && (n.lines ?? 2) <= 3 && !n.route) n.trivial = true;
}

// ---------------------------------------------------------------- compact output
const allNodes = [...nodes.values(), ...storeNodes.values(), ...httpNodes.values()];
const index = new Map(allNodes.map((n, i) => [n.id, i]));
const KINDS = ["call", "render", "http", "kafka", "inngest", "event", "db", "redis", "s3", "ext", "throws", "fail"];
const strs = [];
const strIdx = new Map();
const S = (s) => {
  if (s == null) return -1;
  if (!strIdx.has(s)) { strIdx.set(s, strs.length); strs.push(s); }
  return strIdx.get(s);
};
const E = edges.filter((e) => index.has(e.s) && index.has(e.t)).map((e) => {
  const row = [index.get(e.s), index.get(e.t), Math.max(0, KINDS.indexOf(e.k)), e.o || 0, S(e.l), S(e.ctx)];
  let flags = 0;
  if (e.onFail || (e.ctx && e.k !== "fail")) flags |= 1;
  if (e.l === "guess") flags |= 2;
  if (e.overlay) flags |= 4;
  if (e.unresolved) flags |= 8;
  row.push(flags);
  return row;
});
const N = allNodes.map((n) => {
  const o = { ...n };
  delete o.lines;
  return o;
});

const graph = {
  generatedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: REPO }).toString().trim(),
  kinds: KINDS, strs, nodes: N, edges: E, types, tables, topics, lakeTopics,
  classes: classes.map((c) => ({ name: c.name, svc: c.svc, pkg: c.pkg, file: c.file, line: c.line, kind: c.kind, table: c.table, doc: c.doc, basePath: c.basePath })),
  flows, services: overlay.services, failures,
  gaps: { unmatchedHttp: [...new Set(unmatched)].sort(), missingOverlayRefs: missing },
};
const json = JSON.stringify(graph);
fs.writeFileSync(path.join(REPO, "docs/architecture/graph.json"), json);
const tpl = fs.readFileSync(path.join(GEN, "template.html"), "utf8");
const html = tpl.replace("/*__GRAPH__*/null", () => json.replace(/<\/script/gi, "<\\/script"));
fs.writeFileSync(path.join(REPO, "docs/architecture/architecture-map.html"), html);

if (!skipExtract) {
  fs.rmSync(path.join(GEN, ".cache"), { recursive: true, force: true });
  fs.cpSync(TMP, path.join(GEN, ".cache"), { recursive: true });
}
const byKind = {};
for (const e of E) byKind[KINDS[e[2]]] = (byKind[KINDS[e[2]]] || 0) + 1;
console.log(`nodes ${N.length} (functions ${nodes.size}), edges ${E.length}`, byKind);
console.log(`html ${(html.length / 1e6).toFixed(2)} MB; unmatched http ${graph.gaps.unmatchedHttp.length}; missing overlay refs ${missing.length}`);
if (missing.length) console.log("missing:", missing.join(", "));
