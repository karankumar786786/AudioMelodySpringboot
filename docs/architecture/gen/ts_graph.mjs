// Ek TypeScript project ka call graph, usi project ke TypeScript compiler aur type checker se
// (isliye `@/` aliases aur imports asli declarations tak resolve hote hain).
//
//   node docs/architecture/gen/ts_graph.mjs <out.json> <service> <projectDir>
//
// Nodes: naam wale functions, arrow-function consts (kitne bhi andar, jaise component ke handlers),
// class aur object methods, Inngest functions. Edges: calls aur JSX renders (code ke order me),
// bahar HTTP (method + path), Inngest events, Redis, S3 aur bahar ki services; `catch` / `.catch()` /
// `onFailure` ke andar ka code alag mark hota hai.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [, , OUT, SERVICE, PROJECT] = process.argv;
const REPO = process.cwd();
const projectDir = path.resolve(PROJECT);
const require = createRequire(path.join(projectDir, "package.json"));
const ts = require("typescript");

const cfgPath = ts.findConfigFile(projectDir, ts.sys.fileExists, "tsconfig.json");
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
const isOwn = (f) =>
  f.startsWith(projectDir + path.sep) &&
  !f.includes(`${path.sep}node_modules${path.sep}`) &&
  !f.endsWith(".d.ts") &&
  !/(\.test\.|\.spec\.|__tests__|[\\/]e2e[\\/]|[\\/]test[\\/]|[\\/]tests[\\/]|[\\/]dist[\\/]|[\\/]\.next[\\/]|[\\/]\.expo[\\/])/.test(f);

// Project ki har source file program me ho, chahe tsconfig ka "include" chhota ho.
function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist", ".expo", ".git", "android", "ios", "coverage", "test-results", "playwright-report"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|mts)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const roots = [...new Set([...parsed.fileNames, ...walk(projectDir, [])].map((f) => path.resolve(f)))].filter(isOwn);
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true, skipLibCheck: true });
const checker = program.getTypeChecker();

const rel = (f) => path.relative(REPO, f);
const nodes = [];
const edges = [];
const types = {};
const declToId = new Map(); // ts.Node -> id
const idCount = new Map();

const COMMON = new Set(["map", "filter", "forEach", "push", "then", "catch", "find", "reduce", "some", "every", "join", "split", "slice", "includes", "keys", "values", "entries", "toString", "log", "warn", "error", "info", "debug", "set", "get", "has", "delete", "add", "clear", "parse", "stringify", "resolve", "reject", "all", "now", "floor", "round", "max", "min", "abs", "ceil", "random", "assign", "from", "isArray", "trim", "replace", "toLowerCase", "toUpperCase", "startsWith", "endsWith", "indexOf", "concat", "sort", "flat", "flatMap", "padStart", "toFixed", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "useState", "useEffect", "useMemo", "useCallback", "useRef", "useContext", "dispatch", "addEventListener", "removeEventListener", "preventDefault", "stopPropagation"]);
const EVENT = /^(audio|shorts)\/[a-z.\-]+$/;

function kindFor(file, name, decl) {
  const f = rel(file);
  if (/functions[\\/]/.test(f) && SERVICE === "audioProcessing") return "inngest-fn";
  if (/(^|[\\/])app[\\/].*(page|layout|_layout|index|\[)/.test(f) || /[\\/]app[\\/]/.test(f) && /^[A-Z]/.test(name) === false && f.endsWith(".tsx")) return "screen";
  if (/^use[A-Z]/.test(name)) return "hook";
  if (/[\\/]store[\\/]/.test(f)) return "store";
  if (/[\\/](service|services|api|lib[\\/]api|lib[\\/]queries)[\\/]/.test(f) || /Service\.ts$/.test(f)) return "api";
  if (/^[A-Z]/.test(name) && f.endsWith(".tsx")) return "component";
  if (/[\\/]components[\\/]/.test(f)) return "component";
  return "function";
}

function lineOf(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function typeStr(t) {
  try {
    const s = checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType);
    return s.replace(/import\("[^"]+"\)\./g, "").slice(0, 300);
  } catch {
    return undefined;
  }
}

function docOf(node) {
  const sym = node.name && checker.getSymbolAtLocation(node.name);
  const d = sym ? ts.displayPartsToString(sym.getDocumentationComment(checker)) : "";
  if (d) return d.replace(/\s+/g, " ").slice(0, 400);
  const full = node.getFullText();
  const m = full.match(/\/\*\*([\s\S]*?)\*\//);
  if (m && full.indexOf(m[0]) < full.indexOf(node.getText().slice(0, 20))) return m[1].replace(/^\s*\*\s?/gm, " ").replace(/\s+/g, " ").trim().slice(0, 400);
  return undefined;
}

function register(fnNode, name, owner, sf, extra = {}) {
  const base = `ts:${SERVICE}:${rel(sf.fileName)}#${owner ? owner + "." : ""}${name}`;
  const n = idCount.get(base) || 0;
  idCount.set(base, n + 1);
  const id = n ? `${base}~${n}` : base;
  declToId.set(fnNode, id);
  let sig, ret;
  try {
    const s = checker.getSignatureFromDeclaration(fnNode);
    if (s) {
      ret = typeStr(checker.getReturnTypeOfSignature(s));
      const params = (fnNode.parameters || []).map((p) => p.getText(sf).replace(/\s+/g, " ").slice(0, 80)).join(", ");
      sig = `${name}(${params})${ret ? ": " + ret : ""}`;
    }
  } catch {}
  const body = fnNode.body;
  const lines = lineOf(sf, fnNode.end) - lineOf(sf, fnNode.getStart(sf)) + 1;
  const node = {
    id, name, cls: owner || undefined, pkg: path.dirname(rel(sf.fileName)), svc: SERVICE, file: rel(sf.fileName),
    line: lineOf(sf, fnNode.getStart(sf)), kind: kindFor(sf.fileName, name, fnNode), sig: sig || name + "()", ret, lang: "ts", lines,
    ...extra,
  };
  const doc = docOf(fnNode.parent && ts.isVariableDeclaration(fnNode.parent) ? fnNode.parent : fnNode);
  if (doc) node.doc = doc;
  if (body && !ts.isBlock(body)) node.returns = [body.getText(sf).replace(/\s+/g, " ").slice(0, 200)];
  else if (body) {
    const rs = [];
    const visit = (n) => {
      if (ts.isFunctionLike(n) && n !== fnNode) return;
      if (ts.isReturnStatement(n) && n.expression && rs.length < 3) {
        const t = n.expression.getText(sf).replace(/\s+/g, " ");
        if (!t.startsWith("<") && !t.startsWith("(\n") || t.length < 120) rs.push(t.slice(0, 200));
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    if (rs.length) node.returns = rs;
  }
  nodes.push(node);
  return node;
}

const isFn = (n) => n && (ts.isArrowFunction(n) || ts.isFunctionExpression(n));
// forwardRef(function X(){}), memo(() => {}), useCallback(() => {}, []) ke andar ka function nikalo
function unwrapFn(init) {
  if (!init) return undefined;
  if (isFn(init)) return init;
  if (ts.isCallExpression(init) && init.arguments.length) {
    const callee = init.expression.getText();
    if (/^(React\.)?(forwardRef|memo|useCallback|useMemo)$/.test(callee) || /^createAsyncThunk$|^createSlice$/.test(callee)) {
      for (const a of init.arguments) if (isFn(a)) return a;
    }
  }
  if (ts.isAsExpression(init) || ts.isSatisfiesExpression?.(init) || ts.isParenthesizedExpression(init)) return unwrapFn(init.expression);
  return undefined;
}

// ---------- pass 1: declarations ki list ----------
const inngestFns = []; // {id, call}
for (const sf of program.getSourceFiles()) {
  if (!isOwn(sf.fileName)) continue;
  const fileBase = path.basename(sf.fileName).replace(/\.(tsx?|mts)$/, "");
  const visit = (n, owner) => {
    if (ts.isFunctionDeclaration(n) && n.body) {
      const name = n.name ? n.name.text : fileBase === "page" || fileBase === "layout" ? `${fileBase}` : "default";
      register(n, name, owner, sf);
      ts.forEachChild(n.body, (c) => visit(c, owner ? owner + "." + name : name));
      return;
    }
    if (ts.isClassDeclaration(n) && n.name) {
      for (const m of n.members) {
        if ((ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m) || ts.isGetAccessor(m)) && m.body) {
          const mn = ts.isConstructorDeclaration(m) ? "constructor" : m.name.getText(sf);
          register(m, mn, n.name.text, sf, { kind: "method" });
          ts.forEachChild(m.body, (c) => visit(c, n.name.text + "." + mn));
        } else if (ts.isPropertyDeclaration(m) && isFn(m.initializer)) {
          register(m.initializer, m.name.getText(sf), n.name.text, sf, { kind: "method" });
          ts.forEachChild(m.initializer.body, (c) => visit(c, n.name.text + "." + m.name.getText(sf)));
        }
      }
      return;
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const name = n.name.text;
      const init = n.initializer;
      // inngest.createFunction(config, trigger, handler)
      if (ts.isCallExpression(init) && /createFunction$/.test(init.expression.getText(sf))) {
        const handler = init.arguments.find(isFn);
        if (handler) {
          const cfgObj = init.arguments[0];
          const idProp = cfgObj && ts.isObjectLiteralExpression(cfgObj) ? cfgObj.properties.find((p) => p.name?.getText(sf) === "id") : undefined;
          const node = register(handler, name, owner, sf, { kind: "inngest-fn", inngestId: idProp?.initializer?.getText(sf).replace(/["'`]/g, "") });
          inngestFns.push({ id: node.id, call: init, sf });
          ts.forEachChild(handler.body, (c) => visit(c, name));
          // onFailure handler (saare retries fail hone ke baad chalta hai)
          if (cfgObj && ts.isObjectLiteralExpression(cfgObj)) {
            for (const p of cfgObj.properties) {
              const pn = p.name?.getText(sf);
              const fn = ts.isPropertyAssignment(p) ? p.initializer : ts.isMethodDeclaration(p) ? p : undefined;
              if (pn === "onFailure" && fn && (isFn(fn) || ts.isMethodDeclaration(fn))) {
                const f = register(fn, "onFailure", name, sf, { kind: "failure-handler" });
                edges.push({ s: node.id, t: f.id, k: "fail", l: "after retries are exhausted" });
                ts.forEachChild(fn.body, (c) => visit(c, name + ".onFailure"));
              }
            }
          }
          return;
        }
      }
      const fn = unwrapFn(init);
      if (fn) {
        register(fn, name, owner, sf);
        if (fn.body) ts.forEachChild(fn.body, (c) => visit(c, owner ? owner + "." + name : name));
        return;
      }
      // functions wala object: export const songsApi = { getById: async () => ... }
      if (ts.isObjectLiteralExpression(init)) {
        for (const p of init.properties) {
          const pn = p.name?.getText(sf);
          if (ts.isPropertyAssignment(p) && unwrapFn(p.initializer)) {
            const f = unwrapFn(p.initializer);
            register(f, pn, name, sf);
            if (f.body) ts.forEachChild(f.body, (c) => visit(c, name + "." + pn));
          } else if (ts.isMethodDeclaration(p) && p.body) {
            register(p, pn, name, sf);
            ts.forEachChild(p.body, (c) => visit(c, name + "." + pn));
          }
        }
      }
    }
    if (ts.isExportAssignment(n) && isFn(n.expression)) {
      register(n.expression, "default", owner, sf);
    }
    // "output kaisa dikhta hai" ke liye types
    if (!owner && (ts.isInterfaceDeclaration(n) || (ts.isTypeAliasDeclaration(n) && ts.isTypeLiteralNode(n.type)))) {
      const members = ts.isInterfaceDeclaration(n) ? n.members : n.type.members;
      const fields = [];
      for (const m of members) if (m.name) fields.push([m.name.getText(sf) + (m.questionToken ? "?" : ""), m.type ? m.type.getText(sf).replace(/\s+/g, " ").slice(0, 80) : "fn"]);
      if (fields.length) types[n.name.text] = { fields: fields.slice(0, 40), file: rel(sf.fileName), svc: SERVICE };
    }
    ts.forEachChild(n, (c) => visit(c, owner));
  };
  ts.forEachChild(sf, (c) => visit(c, undefined));
}

// ---------- pass 2: function bodies ----------
function resolveDecl(expr) {
  let sym = checker.getSymbolAtLocation(expr);
  if (!sym) return undefined;
  if (sym.flags & ts.SymbolFlags.Alias) {
    try { sym = checker.getAliasedSymbol(sym); } catch {}
  }
  for (const d of sym.declarations || []) {
    if (declToId.has(d)) return declToId.get(d);
    if (ts.isVariableDeclaration(d)) {
      const fn = unwrapFn(d.initializer);
      if (fn && declToId.has(fn)) return declToId.get(fn);
      if (d.initializer && ts.isCallExpression(d.initializer)) {
        const h = d.initializer.arguments.find(isFn);
        if (h && declToId.has(h)) return declToId.get(h);
      }
    }
    if (ts.isPropertyAssignment(d)) {
      const fn = unwrapFn(d.initializer);
      if (fn && declToId.has(fn)) return declToId.get(fn);
    }
    if (ts.isShorthandPropertyAssignment(d)) {
      const v = checker.getShorthandAssignmentValueSymbol(d);
      for (const vd of v?.declarations || []) {
        const fn = ts.isVariableDeclaration(vd) ? unwrapFn(vd.initializer) : vd;
        if (fn && declToId.has(fn)) return declToId.get(fn);
      }
    }
  }
  return undefined;
}

const strOf = (e, sf) => {
  if (!e) return undefined;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) {
    let s = e.head.text;
    for (const sp of e.templateSpans) s += "{" + sp.expression.getText(sf).replace(/\s+/g, "").slice(0, 30) + "}" + sp.literal.text;
    return s;
  }
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const l = strOf(e.left, sf), r = strOf(e.right, sf);
    return (l ?? "{" + e.left.getText(sf).slice(0, 30) + "}") + (r ?? "{…}");
  }
  return undefined;
};

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const HTTP_FUNCS = /^(fetch|adminFetch|apiGet|apiRequest|apiPost|apiPut|apiPatch|apiDelete|request|apiFetch|authFetch)$/;

function httpInfo(call, sf) {
  const ex = call.expression;
  let method, url, recv;
  if (ts.isPropertyAccessExpression(ex) && HTTP_METHODS.has(ex.name.text)) {
    recv = ex.expression.getText(sf);
    if (!/^(api|apiClient|axios|client|http|deleteApi|shortApi|authApi|plainAxios|publicApi|instance|this\.client|baseApi|adminApi|axiosInstance)$/i.test(recv) && !/api|axios|client/i.test(recv)) return undefined;
    if (/searchClient|algolia|recombee|redis|map|params|headers|cache|store|query/i.test(recv)) return undefined;
    method = ex.name.text.toUpperCase();
    url = strOf(call.arguments[0], sf);
  } else if (ts.isIdentifier(ex) && HTTP_FUNCS.test(ex.text)) {
    url = strOf(call.arguments[0], sf);
    method = "GET";
    const opts = call.arguments[1];
    if (opts && ts.isObjectLiteralExpression(opts)) {
      const m = opts.properties.find((p) => p.name?.getText(sf) === "method");
      const mv = m && ts.isPropertyAssignment(m) ? strOf(m.initializer, sf) : undefined;
      if (mv) method = mv.toUpperCase();
    }
    if (ex.text.startsWith("api") && /Post|Put|Patch|Delete/.test(ex.text)) method = ex.text.replace("api", "").toUpperCase();
    if (/^api(Request)?$/.test(ex.text) && call.arguments[1] && strOf(call.arguments[1], sf) && /^(GET|POST|PUT|PATCH|DELETE)$/i.test(strOf(call.arguments[1], sf))) method = strOf(call.arguments[1], sf).toUpperCase();
    recv = ex.text;
  } else return undefined;
  if (url === undefined) {
    const a0 = call.arguments[0];
    if (!a0) return undefined;
    url = "{" + a0.getText(sf).slice(0, 40) + "}";
  }
  return { method, url, recv };
}

function externalOf(call, sf) {
  const t = call.expression.getText(sf);
  if (/redis/i.test(t) && ts.isPropertyAccessExpression(call.expression)) {
    const key = strOf(call.arguments[0], sf);
    return { t: "redis:" + (key ? key.replace(/\{.*$/, "") : "client"), k: "redis", l: call.expression.name.text + (key ? " " + key : "") };
  }
  if (/\b(s3|S3Client|s3Client)\b/.test(t) && ts.isPropertyAccessExpression(call.expression)) return { t: "s3:client", k: "s3", l: t.slice(0, 60) };
  if (/algolia|searchClient|index\.(save|delete|partial)/i.test(t)) return { t: "ext:algolia", k: "ext", l: t.slice(0, 60) };
  if (/recombee/i.test(t)) return { t: "ext:recombee", k: "ext", l: t.slice(0, 60) };
  if (/imagekit/i.test(t)) return { t: "ext:imagekit", k: "ext", l: t.slice(0, 60) };
  if (/ffmpeg|ffprobe|spawn|execFile|Bun\.spawn|\$`/.test(t)) return { t: "ext:ffmpeg", k: "ext", l: t.slice(0, 60) };
  if (/sendMail|transporter|ses\.|resend\./i.test(t)) return { t: "ext:mail", k: "ext", l: t.slice(0, 60) };
  return undefined;
}

for (const sf of program.getSourceFiles()) {
  if (!isOwn(sf.fileName)) continue;
  const stack = [];
  const ctxStack = [];
  const counters = new Map();
  const seen = new Map();
  const add = (s, e) => {
    const o = (counters.get(s) || 0) + 1;
    counters.set(s, o);
    const key = `${e.t}|${e.k}|${e.ctx || ""}|${e.l || ""}`;
    const set = seen.get(s) || new Set();
    seen.set(s, set);
    if (set.has(key)) return;
    set.add(key);
    edges.push({ s, o, ...e });
  };
  const visit = (n) => {
    const own = declToId.get(n);
    if (own) stack.push(own);
    const cur = stack[stack.length - 1];
    let pushedCtx = false;
    if (ts.isCatchClause(n)) { ctxStack.push("catch " + (n.variableDeclaration?.type?.getText(sf) || "error")); pushedCtx = true; }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "catch") {
      // receiver normal scan, handler ko failure path maano
      visit(n.expression.expression);
      ctxStack.push(".catch()");
      n.arguments.forEach(visit);
      ctxStack.pop();
      if (own) stack.pop();
      return;
    }
    if (cur) {
      const ctx = ctxStack[ctxStack.length - 1];
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
        // pehle bachche nodes, taaki andar ki calls bahar wali se pehle gine
        ts.forEachChild(n, visit);
        const callee = n.expression;
        const http = ts.isCallExpression(n) ? httpInfo(n, sf) : undefined;
        if (http) add(cur, { t: "http:" + http.method + " " + http.url, k: "httpcall", l: `${http.method} ${http.url}`, recv: http.recv, ctx });
        let target = resolveDecl(ts.isPropertyAccessExpression(callee) ? callee.name : callee);
        if (!target && ts.isPropertyAccessExpression(callee)) target = resolveDecl(callee);
        if (target && target !== cur) add(cur, { t: target, k: "call", ctx });
        else if (!target && !http) {
          const ext = ts.isCallExpression(n) ? externalOf(n, sf) : undefined;
          if (ext) add(cur, { ...ext, ctx });
          if (ts.isNewExpression(n) && /Command$/.test(callee.getText(sf)) && /Object|Upload|Multipart/.test(callee.getText(sf))) add(cur, { t: "s3:client", k: "s3", l: "new " + callee.getText(sf), ctx });
        }
        // step.invoke("x", { function: transcodeAudioTask }) - doosra Inngest function chalana
        if (ts.isCallExpression(n) && /\.invoke$/.test(callee.getText(sf))) {
          const o = n.arguments[1];
          if (o && ts.isObjectLiteralExpression(o)) {
            const fp = o.properties.find((p) => p.name?.getText(sf) === "function");
            if (fp && ts.isPropertyAssignment(fp)) {
              const t = resolveDecl(fp.initializer);
              if (t) add(cur, { t, k: "inngest", l: "step.invoke", ctx });
            }
          }
        }
        if (pushedCtx) ctxStack.pop();
        if (own) stack.pop();
        return;
      }
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const t = resolveDecl(n.tagName);
        if (t && t !== cur) add(cur, { t, k: "render", ctx });
      }
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && EVENT.test(n.text)) {
        const p = n.parent;
        const isTrigger = p && ts.isPropertyAssignment(p) && p.name.getText(sf) === "event";
        if (!isTrigger) add(cur, { t: "inngest:" + n.text, k: "inngest", l: "send " + n.text, ctx });
      }
      if (ts.isPropertyAccessExpression(n) && /^(process\.env)$/.test(n.expression.getText(sf))) {
        add(cur, { t: "env:" + n.name.text, k: "env", l: n.name.text });
      }
    }
    ts.forEachChild(n, visit);
    if (pushedCtx) ctxStack.pop();
    if (own) stack.pop();
  };
  visit(sf);
}

// Inngest triggers aur cancellations
for (const { id, call, sf } of inngestFns) {
  const [cfgObj, trig] = call.arguments;
  const evs = [];
  const collect = (o, kind) => {
    if (!o) return;
    if (ts.isObjectLiteralExpression(o)) {
      for (const p of o.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const pn = p.name.getText(sf);
        if (pn === "event") { const v = strOf(p.initializer, sf); if (v) evs.push([v, kind]); }
        if (pn === "cancelOn") collect(p.initializer, "cancel");
      }
    } else if (ts.isArrayLiteralExpression(o)) o.elements.forEach((e) => collect(e, kind));
  };
  collect(trig, "trigger");
  collect(cfgObj, "trigger");
  for (const [ev, kind] of evs) edges.push({ s: "inngest:" + ev, t: id, k: kind === "cancel" ? "fail" : "inngest", l: kind === "cancel" ? "cancels a running job: " + ev : "triggers" });
  const node = nodes.find((x) => x.id === id);
  if (node) node.route = evs.filter((e) => e[1] === "trigger").map((e) => e[0]).join(", ");
}

fs.writeFileSync(OUT, JSON.stringify({ nodes, edges, types }));
console.error(`ts ${SERVICE}: ${roots.length} files, ${nodes.length} functions, ${edges.length} edges`);
