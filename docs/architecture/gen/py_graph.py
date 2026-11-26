"""Call graph for the Django admin API, from the standard-library ast module.

    python3 docs/architecture/gen/py_graph.py <out.json> adminBackend/admin

Resolves calls through imports, `self`, attributes set in __init__, local variables
assigned from a constructor, and Django model managers. Adds Django routes, ORM/SQL
tables, Redis keys, Inngest events, outbound HTTP and the code that runs in `except`.
"""
import ast
import json
import os
import re
import sys

OUT, ROOT = sys.argv[1], sys.argv[2]
REPO = os.getcwd()
SERVICE = "adminBackend"

COMMON = {"get", "post", "put", "patch", "delete", "save", "filter", "all", "first", "items", "keys", "values",
          "append", "extend", "update", "pop", "join", "split", "strip", "format", "lower", "upper", "exists",
          "count", "order_by", "values_list", "create", "exclude", "select_related", "prefetch_related", "only",
          "info", "warning", "error", "exception", "debug", "setdefault", "startswith", "endswith", "replace",
          "is_valid", "send", "close", "execute", "fetchall", "fetchone", "encode", "decode", "dumps", "loads",
          "list", "dict", "set", "str", "int", "float", "len", "isinstance", "getattr", "hasattr", "super",
          "as_view", "copy", "sort", "add", "remove", "read", "write", "json", "isoformat", "now", "run", "time"}

WRITE_OPS = {"create", "update", "delete", "bulk_create", "bulk_update", "get_or_create", "update_or_create", "save"}

modules = {}          # module -> {"tree", "file", "imports"}
functions = {}        # id -> node dict
classes = {}          # module.Class -> {"bases", "methods", "attrs", "table", "kind", "file", "line"}
class_by_name = {}    # Class -> [module.Class]
func_by_name = {}     # name -> [ids]
edges = []
types = {}
routes = []


def rel(p):
    return os.path.relpath(p, REPO)


def mod_name(path):
    r = os.path.relpath(path, ROOT)[:-3].replace(os.sep, ".")
    return r[:-9] if r.endswith(".__init__") else r


def first_line(doc):
    if not doc:
        return None
    d = " ".join(doc.strip().split())
    return d[:400]


def unparse(n, limit=240):
    try:
        s = ast.unparse(n)
    except Exception:
        return None
    s = " ".join(s.split())
    return s if len(s) <= limit else s[:limit] + "…"


# ---------------- pass 1: modules, classes, functions ----------------
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = [d for d in dirnames if d not in ("migrations", "__pycache__", "tests", ".venv", "venv")]
    for f in filenames:
        if not f.endswith(".py") or f.startswith("test") or f.endswith("_test.py"):
            continue
        path = os.path.join(dirpath, f)
        try:
            tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
        except SyntaxError:
            continue
        m = mod_name(path)
        imports = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module is not None or isinstance(node, ast.ImportFrom) and node.level:
                base = node.module or ""
                if node.level:
                    parts = m.split(".")
                    pkg = parts[:-node.level] if not path.endswith("__init__.py") else parts[: len(parts) - node.level + 1]
                    base = ".".join(pkg + ([base] if base else []))
                for a in node.names:
                    imports[a.asname or a.name] = f"{base}.{a.name}" if base else a.name
            elif isinstance(node, ast.Import):
                for a in node.names:
                    imports[a.asname or a.name.split(".")[0]] = a.name
        modules[m] = {"tree": tree, "file": rel(path), "imports": imports}


def add_function(m, cls, fn, file):
    qual = f"{m}.{cls}.{fn.name}" if cls else f"{m}.{fn.name}"
    fid = "py:" + qual
    args = [a.arg for a in fn.args.args if a.arg not in ("self", "cls")]
    ret = unparse(fn.returns) if fn.returns else None
    returns = []
    for n in ast.walk(fn):
        if isinstance(n, ast.Return) and n.value is not None:
            s = unparse(n.value, 200)
            if s and s not in returns:
                returns.append(s)
    node = {"id": fid, "name": fn.name, "cls": cls, "pkg": m.rsplit(".", 1)[0] if "." in m else m, "svc": SERVICE,
            "file": file, "line": fn.lineno, "sig": f"{fn.name}({', '.join(args)})" + (f" -> {ret}" if ret else ""),
            "ret": ret, "lang": "py", "kind": "function"}
    if returns:
        node["returns"] = returns[:4]
    doc = first_line(ast.get_docstring(fn))
    if doc:
        node["doc"] = doc
    decos = [unparse(d, 80) for d in fn.decorator_list]
    if decos:
        node["ann"] = ["@" + d for d in decos if d]
    if len(fn.body) <= 1 and (fn.name.startswith("get_") or fn.name.startswith("__")) or fn.name in ("__str__", "__repr__"):
        node["trivial"] = True
    functions[fid] = node
    func_by_name.setdefault(fn.name, []).append(fid)
    return fid


for m, info in modules.items():
    for node in info["tree"].body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            add_function(m, None, node, info["file"])
        elif isinstance(node, ast.ClassDef):
            key = f"{m}.{node.name}"
            bases = [unparse(b, 80) for b in node.bases]
            c = {"bases": bases, "methods": {}, "attrs": {}, "table": None, "file": info["file"], "line": node.lineno,
                 "name": node.name, "module": m, "doc": first_line(ast.get_docstring(node))}
            if any(b and (b.endswith("Model") or b == "models.Model") for b in bases):
                c["kind"] = "model"
                fields = []
                for st in node.body:
                    if isinstance(st, ast.Assign) and isinstance(st.value, ast.Call):
                        fname = getattr(st.targets[0], "id", None)
                        ftype = unparse(st.value.func, 60)
                        if fname and ftype and "Field" in ftype or (ftype and "ForeignKey" in ftype):
                            fields.append([fname, ftype.split(".")[-1]])
                    if isinstance(st, ast.ClassDef) and st.name == "Meta":
                        for ms in st.body:
                            if isinstance(ms, ast.Assign) and getattr(ms.targets[0], "id", "") == "db_table":
                                c["table"] = getattr(ms.value, "value", None)
                if not c["table"]:
                    c["table"] = re.sub(r"(?<!^)(?=[A-Z])", "_", node.name).lower()
                types[node.name] = {"fields": fields, "file": info["file"], "svc": SERVICE, "table": c["table"]}
            elif any(b and ("Serializer" in b) for b in bases):
                c["kind"] = "serializer"
                fields = []
                for st in node.body:
                    if isinstance(st, ast.Assign) and isinstance(st.value, ast.Call):
                        fname = getattr(st.targets[0], "id", None)
                        if fname:
                            fields.append([fname, (unparse(st.value.func, 60) or "").split(".")[-1]])
                    if isinstance(st, ast.ClassDef) and st.name == "Meta":
                        for ms in st.body:
                            if isinstance(ms, ast.Assign) and getattr(ms.targets[0], "id", "") == "fields":
                                v = ms.value
                                if isinstance(v, (ast.List, ast.Tuple)):
                                    fields += [[getattr(e, "value", "?"), "field"] for e in v.elts]
                types[node.name] = {"fields": fields, "file": info["file"], "svc": SERVICE}
            elif any(b and ("View" in b or "APIView" in b) for b in bases):
                c["kind"] = "view"
            elif node.name.endswith("Service") or "services" in m:
                c["kind"] = "service"
            else:
                c["kind"] = "class"
            classes[key] = c
            class_by_name.setdefault(node.name, []).append(key)
            for st in node.body:
                if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    fid = add_function(m, node.name, st, info["file"])
                    c["methods"][st.name] = fid
                    functions[fid]["kind"] = c["kind"] if c["kind"] != "class" else "method"
                    if st.name == "__init__" or True:
                        for n in ast.walk(st):
                            if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Attribute) \
                                    and getattr(n.targets[0].value, "id", "") == "self" and isinstance(n.value, ast.Call):
                                ctor = unparse(n.value.func, 80)
                                if ctor:
                                    c["attrs"][n.targets[0].attr] = ctor.split(".")[-1]


def resolve_class(name, m):
    """Class key for a name seen in module m."""
    if not name:
        return None
    imp = modules[m]["imports"].get(name)
    if imp:
        if imp in classes:
            return imp
        short = imp.split(".")[-1]
        cands = class_by_name.get(short, [])
        for c in cands:
            if imp.endswith(c.split(".", 0)[0]) or c.endswith("." + short):
                return c
    if f"{m}.{name}" in classes:
        return f"{m}.{name}"
    cands = class_by_name.get(name, [])
    return cands[0] if len(cands) == 1 else None


def method_of(ckey, name, depth=0):
    if not ckey or depth > 5:
        return None
    c = classes.get(ckey)
    if not c:
        return None
    if name in c["methods"]:
        return c["methods"][name]
    for b in c["bases"]:
        bk = resolve_class((b or "").split(".")[-1], c["module"])
        r = method_of(bk, name, depth + 1)
        if r:
            return r
    return None


def edge(s, t, k, o=0, l=None, ctx=None):
    e = {"s": s, "t": t, "k": k}
    if o:
        e["o"] = o
    if l:
        e["l"] = l
    if ctx:
        e["ctx"] = ctx
        if k != "fail":
            e["onFail"] = True
    edges.append(e)


SQL = re.compile(r"(?i)\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+([a-z_][a-z0-9_]*)")
NOT_TABLES = {"set", "select", "where", "the", "unnest", "values", "lateral", "read_parquet", "generate_series", "now", "only", "plays", "src", "t", "x"}
INNGEST = re.compile(r"^(audio|shorts)/[a-z.\-]+$")
REDIS = re.compile(r"^(admin|blocked_user|paginationMetaData|lake|system|mail_queue|audio_processing|delete_event)[:_a-zA-Z]*:?")


# ---------------- pass 2: bodies ----------------
class BodyScanner(ast.NodeVisitor):
    def __init__(self, fid, m, ckey, fn):
        self.fid, self.m, self.ckey, self.fn = fid, m, ckey, fn
        self.order = 0
        self.locals = {}
        self.ctx = []
        self.seen = set()

    def nxt(self):
        self.order += 1
        return self.order

    def visit_Try(self, node):
        for n in node.body:
            self.visit(n)
        for h in node.handlers:
            self.ctx.append("except " + (unparse(h.type, 60) if h.type else "Exception"))
            for n in h.body:
                self.visit(n)
            self.ctx.pop()
        for n in node.orelse + node.finalbody:
            self.visit(n)

    def visit_Assign(self, node):
        self.generic_visit(node)
        if isinstance(node.value, ast.Call):
            f = node.value.func
            name = None
            if isinstance(f, ast.Name):
                name = f.id
            elif isinstance(f, ast.Attribute) and isinstance(f.value, ast.Attribute) and f.value.attr == "objects":
                name = getattr(f.value.value, "id", None)  # Model.objects.get(...) -> Model instance
            ck = resolve_class(name, self.m) if name else None
            if ck:
                for t in node.targets:
                    if isinstance(t, ast.Name):
                        self.locals[t.id] = ck

    def visit_Raise(self, node):
        if node.exc is not None:
            ex = unparse(node.exc.func if isinstance(node.exc, ast.Call) else node.exc, 60)
            if ex:
                edge(self.fid, "exception:" + ex.split(".")[-1], "throws", self.nxt(), ex.split(".")[-1])
        self.generic_visit(node)

    def visit_Constant(self, node):
        if isinstance(node.value, str):
            s = node.value
            if re.search(r"(?is)\b(select|insert|update|delete)\b", s) and len(s) > 15:
                done = set()
                for verb, table in SQL.findall(s):
                    t = table.lower()
                    if t in NOT_TABLES or (t, verb) in done:
                        continue
                    done.add((t, verb))
                    mode = "read" if verb.upper() in ("FROM", "JOIN") else "write"
                    edge(self.fid, "table:" + t, "db", self.nxt(), mode + " (SQL)")
            if INNGEST.match(s):
                edge(self.fid, "inngest:" + s, "inngest", self.nxt(), "send " + s, self.ctx[-1] if self.ctx else None)
            if REDIS.match(s) and " " not in s and len(s) < 60:
                edge(self.fid, "redis:" + s, "redis", self.nxt(), s)

    def visit_JoinedStr(self, node):
        if node.values and isinstance(node.values[0], ast.Constant) and isinstance(node.values[0].value, str):
            s = node.values[0].value
            if REDIS.match(s) and " " not in s:
                edge(self.fid, "redis:" + s, "redis", self.nxt(), s + "{…}")
            if s.startswith("/") or s.startswith("http"):
                pass
        self.generic_visit(node)

    def visit_Call(self, node):
        self.generic_visit(node)  # args first: inner calls happen before the outer one
        f = node.func
        ctx = self.ctx[-1] if self.ctx else None
        target = None
        label = None
        if isinstance(f, ast.Name):
            name = f.id
            imp = modules[self.m]["imports"].get(name)
            if f"py:{self.m}.{name}" in functions:
                target = f"py:{self.m}.{name}"
            elif imp and f"py:{imp}" in functions:
                target = f"py:{imp}"
            else:
                ck = resolve_class(name, self.m)
                if ck:
                    target = method_of(ck, "__init__")
                    label = "new " + name
        elif isinstance(f, ast.Attribute):
            name = f.attr
            recv = f.value
            if isinstance(recv, ast.Name):
                r = recv.id
                if r in ("self", "cls"):
                    target = method_of(self.ckey, name)
                elif r in self.locals:
                    target = method_of(self.locals[r], name)
                    ck = self.locals[r]
                    if not target and classes.get(ck, {}).get("kind") == "model" and name in ("save", "delete"):
                        edge(self.fid, "table:" + classes[ck]["table"], "db", self.nxt(), f"write via {classes[ck]['name']}.{name}()", ctx)
                        return
                else:
                    imp = modules[self.m]["imports"].get(r)
                    ck = resolve_class(r, self.m)
                    if ck:
                        target = method_of(ck, name)
                    elif imp and f"py:{imp}.{name}" in functions:
                        target = f"py:{imp}.{name}"
                    elif r == "requests" or r == "httpx":
                        edge(self.fid, "ext:http", "ext", self.nxt(), f"{r}.{name}(" + (unparse(node.args[0], 80) if node.args else "") + ")", ctx)
                        return
                    elif r in ("boto3",) or "s3" in r.lower():
                        edge(self.fid, "s3:client", "s3", self.nxt(), f"{r}.{name}", ctx)
                        return
                    elif r == "duckdb":
                        edge(self.fid, "ext:duckdb", "ext", self.nxt(), "duckdb." + name, ctx)
                        return
            elif isinstance(recv, ast.Attribute):
                if getattr(recv.value, "id", None) == "self":
                    attr_cls = classes.get(self.ckey, {}).get("attrs", {}).get(recv.attr)
                    ck = resolve_class(attr_cls, self.m) if attr_cls else None
                    if ck:
                        target = method_of(ck, name)
                    elif recv.attr in ("client", "s3", "s3_client") and "s3" in self.m:
                        edge(self.fid, "s3:client", "s3", self.nxt(), f"s3.{name}", ctx)
                        return
                    elif "redis" in recv.attr.lower():
                        edge(self.fid, "redis:client", "redis", self.nxt(), f"redis.{name}", ctx)
                        return
                if recv.attr == "objects":
                    model = getattr(recv.value, "id", None)
                    ck = resolve_class(model, self.m)
                    if ck and classes[ck].get("kind") == "model":
                        mode = "write" if name in WRITE_OPS else "read"
                        edge(self.fid, "table:" + classes[ck]["table"], "db", self.nxt(), f"{mode} via {model}.objects.{name}()", ctx)
                        return
            elif isinstance(recv, ast.Call) and isinstance(recv.func, ast.Attribute) and isinstance(recv.func.value, ast.Attribute) and recv.func.value.attr == "objects":
                model = getattr(recv.func.value.value, "id", None)
                ck = resolve_class(model, self.m)
                if ck and classes[ck].get("kind") == "model":
                    mode = "write" if name in WRITE_OPS else "read"
                    edge(self.fid, "table:" + classes[ck]["table"], "db", self.nxt(), f"{mode} via {model}.objects…{name}()", ctx)
                    return
            elif isinstance(recv, ast.Call) and isinstance(recv.func, ast.Name) and recv.func.id == "super":
                c = classes.get(self.ckey)
                for b in (c or {}).get("bases", []):
                    target = method_of(resolve_class((b or "").split(".")[-1], self.m), name)
                    if target:
                        break
            if not target and name not in COMMON:
                cands = func_by_name.get(name, [])
                if len(cands) == 1 and cands[0] != self.fid:
                    target, label = cands[0], "guess"
        if target and target != self.fid:
            key = (target, ctx)
            if key not in self.seen:
                self.seen.add(key)
                edge(self.fid, target, "call", self.nxt(), label, ctx)


for m, info in modules.items():
    for node in info["tree"].body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            BodyScanner(f"py:{m}.{node.name}", m, None, node).visit(node)
        elif isinstance(node, ast.ClassDef):
            for st in node.body:
                if isinstance(st, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    s = BodyScanner(f"py:{m}.{node.name}.{st.name}", m, f"{m}.{node.name}", st)
                    for stmt in st.body:
                        s.visit(stmt)


# ---------------- Django routes ----------------
def collect_urls(m, prefix):
    info = modules.get(m)
    if not info:
        return
    for node in ast.walk(info["tree"]):
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) in ("path", "re_path") and node.args:
            route = getattr(node.args[0], "value", None)
            if route is None or len(node.args) < 2:
                continue
            target = node.args[1]
            full = "/" + (prefix + route).lstrip("/")
            if isinstance(target, ast.Call) and getattr(target.func, "id", None) == "include":
                inc = getattr(target.args[0], "value", None) if target.args else None
                if inc:
                    collect_urls(inc, prefix + route)
                continue
            view = None
            if isinstance(target, ast.Call) and isinstance(target.func, ast.Attribute) and target.func.attr == "as_view":
                view = unparse(target.func.value, 80)
            elif isinstance(target, (ast.Name, ast.Attribute)):
                view = unparse(target, 80)
            if not view:
                continue
            ck = resolve_class(view.split(".")[-1], m)
            path_norm = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", full)
            if ck:
                for verb in ("get", "post", "put", "patch", "delete"):
                    fid = method_of(ck, verb)
                    if fid and fid.startswith("py:" + ck):
                        functions[fid]["route"] = path_norm
                        functions[fid]["http"] = verb.upper()
                        functions[fid]["kind"] = "endpoint"
                        routes.append({"http": verb.upper(), "route": path_norm, "id": fid})
            else:
                fid = f"py:{m.rsplit('.', 1)[0]}.views.{view}" if "." not in view else None
                if fid and fid in functions:
                    functions[fid]["route"] = path_norm
                    functions[fid]["http"] = "ANY"
                    functions[fid]["kind"] = "endpoint"


collect_urls("admin.urls", "")

cls_out = []
for k, c in classes.items():
    item = {"name": c["name"], "fqn": k, "pkg": c["module"], "svc": SERVICE, "file": c["file"], "line": c["line"],
            "kind": c["kind"], "extends": ", ".join(b for b in c["bases"] if b)}
    if c.get("table"):
        item["table"] = c["table"]
    if c.get("doc"):
        item["doc"] = c["doc"]
    cls_out.append(item)

json.dump({"nodes": list(functions.values()), "edges": edges, "types": types, "classes": cls_out, "routes": routes},
          open(OUT, "w"))
print(f"py: {len(classes)} classes, {len(functions)} functions, {len(edges)} edges, {len(routes)} routes", file=sys.stderr)
