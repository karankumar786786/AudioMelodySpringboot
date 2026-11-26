import com.sun.source.doctree.DocCommentTree;
import com.sun.source.tree.*;
import com.sun.source.util.*;

import javax.lang.model.element.Modifier;
import javax.tools.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/**
 * Extracts a call graph from Java sources with the javac parser (no type attribution, so
 * Lombok and missing classpaths don't matter). Calls are resolved from the declared types
 * of fields, parameters and locals, which fits this codebase's constructor-injected style.
 *
 *   java docs/architecture/gen/JavaGraph.java <out.json> <service>=<srcDir> ...
 */
public class JavaGraph {

    // ---------- model ----------
    static final class ClassInfo {
        String name, fqn, pkg, file, service, kind = "class", superName, tableName, cacheNote;
        List<String> interfaces = new ArrayList<>(), annotations = new ArrayList<>(), typeArgsOfSuper = new ArrayList<>();
        Map<String, String> fields = new LinkedHashMap<>();
        List<String[]> recordFields = new ArrayList<>();
        Map<String, List<MethodInfo>> methods = new LinkedHashMap<>();
        String basePath = "";
        boolean isInterface, lombokData;
        int line;
        String doc;
    }

    static final class MethodInfo {
        String id, name, sig, ret, doc, route, httpMethod;
        ClassInfo owner;
        int line, params;
        MethodTree tree;
        List<String> annotations = new ArrayList<>();
        boolean trivial;
    }

    static final Map<String, ClassInfo> classesBySimple = new HashMap<>();
    static final Map<String, List<ClassInfo>> classesBySimpleMulti = new HashMap<>();
    static final Map<String, List<MethodInfo>> methodsByName = new HashMap<>();
    static final List<ClassInfo> allClasses = new ArrayList<>();
    static final List<Map<String, Object>> edges = new ArrayList<>();
    static final List<Map<String, Object>> nodes = new ArrayList<>();
    static final Map<String, Map<String, Object>> types = new LinkedHashMap<>();
    static final Map<String, String> constants = new HashMap<>(); // Topics.PLAY -> listening.play.v1

    static final Set<String> COMMON = Set.of("get", "put", "set", "of", "build", "builder", "add", "remove", "equals",
            "hashCode", "toString", "apply", "accept", "run", "call", "map", "filter", "stream", "orElse", "size",
            "isEmpty", "contains", "valueOf", "name", "close", "start", "stop", "init", "execute", "process", "send",
            "list", "create", "update", "delete", "save", "find", "handle", "from", "to", "value", "key", "test", "parse",
            "format", "length", "next", "hasNext", "toList", "collect", "forEach", "getId", "id", "write", "read");

    public static void main(String[] args) throws Exception {
        Path out = Path.of(args[0]);
        JavaCompiler javac = ToolProvider.getSystemJavaCompiler();
        StandardJavaFileManager fm = javac.getStandardFileManager(null, null, StandardCharsets.UTF_8);
        List<Object[]> units = new ArrayList<>(); // [service, root, CompilationUnitTree, JavacTask]
        for (int i = 1; i < args.length; i++) {
            String[] kv = args[i].split("=", 2);
            String service = kv[0];
            Path root = Path.of(kv[1]);
            List<Path> files;
            try (Stream<Path> s = Files.walk(root)) {
                files = s.filter(p -> p.toString().endsWith(".java"))
                        .filter(p -> !p.toString().contains("/test/") && !p.toString().contains("/generated-sources/"))
                        .collect(Collectors.toList());
            }
            if (files.isEmpty()) continue;
            JavacTask task = (JavacTask) javac.getTask(null, fm, d -> {}, List.of("-proc:none"), null, fm.getJavaFileObjectsFromPaths(files));
            for (CompilationUnitTree cu : task.parse()) units.add(new Object[]{service, root, cu, task});
        }
        for (Object[] u : units) collectClasses((String) u[0], (CompilationUnitTree) u[2], (JavacTask) u[3]);
        resolveKinds();
        for (ClassInfo c : allClasses) for (List<MethodInfo> ms : c.methods.values()) for (MethodInfo m : ms) {
            methodsByName.computeIfAbsent(m.name, k -> new ArrayList<>()).add(m);
            nodes.add(node(m));
        }
        for (Object[] u : units) scanBodies((CompilationUnitTree) u[2], (JavacTask) u[3]);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("nodes", nodes);
        result.put("edges", edges);
        result.put("types", types);
        List<Map<String, Object>> cls = new ArrayList<>();
        for (ClassInfo c : allClasses) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", c.name); m.put("fqn", c.fqn); m.put("pkg", c.pkg); m.put("svc", c.service);
            m.put("file", c.file); m.put("line", c.line); m.put("kind", c.kind); m.put("ann", c.annotations);
            m.put("fields", c.fields); if (c.tableName != null) m.put("table", c.tableName);
            if (c.superName != null) m.put("extends", c.superName);
            if (!c.interfaces.isEmpty()) m.put("implements", c.interfaces);
            if (c.doc != null) m.put("doc", c.doc);
            if (!c.basePath.isEmpty()) m.put("basePath", c.basePath);
            cls.add(m);
        }
        result.put("classes", cls);
        result.put("constants", constants);
        Files.writeString(out, Json.write(result));
        System.err.printf("java: %d classes, %d methods, %d edges%n", allClasses.size(), nodes.size(), edges.size());
    }

    // ---------- pass 1: classes, fields, methods ----------
    static void collectClasses(String service, CompilationUnitTree cu, JavacTask task) {
        String pkg = cu.getPackageName() == null ? "" : cu.getPackageName().toString();
        String file = rel(cu.getSourceFile().toUri().getPath());
        LineMap lines = cu.getLineMap();
        DocTrees docs = DocTrees.instance(task);
        new TreePathScanner<Void, ClassInfo>() {
            @Override
            public Void visitClass(ClassTree ct, ClassInfo outer) {
                ClassInfo c = new ClassInfo();
                c.name = ct.getSimpleName().toString();
                if (c.name.isEmpty()) return super.visitClass(ct, outer); // anonymous
                c.pkg = pkg; c.fqn = (outer != null ? outer.fqn + "." : (pkg.isEmpty() ? "" : pkg + ".")) + c.name;
                c.file = file; c.service = service;
                c.line = (int) lines.getLineNumber(((com.sun.tools.javac.tree.JCTree) ct).getStartPosition());
                c.isInterface = ct.getKind() == Tree.Kind.INTERFACE;
                c.doc = firstSentence(docs, getCurrentPath());
                for (AnnotationTree a : ct.getModifiers().getAnnotations()) {
                    String an = simple(a.getAnnotationType().toString());
                    c.annotations.add(an);
                    if (an.equals("RequestMapping")) c.basePath = annotationPath(a);
                    if (an.equals("Table")) c.tableName = annotationAttr(a, "name");
                    if (an.equals("Data") || an.equals("Getter") || an.equals("Value")) c.lombokData = true;
                }
                if (ct.getExtendsClause() != null) {
                    Tree ext = ct.getExtendsClause();
                    c.superName = simple(rawType(ext.toString()));
                    if (ext instanceof ParameterizedTypeTree pt) for (Tree ta : pt.getTypeArguments()) c.typeArgsOfSuper.add(simple(rawType(ta.toString())));
                }
                for (Tree it : ct.getImplementsClause()) {
                    c.interfaces.add(simple(rawType(it.toString())));
                    if (it instanceof ParameterizedTypeTree pt && c.isInterface) for (Tree ta : pt.getTypeArguments()) c.typeArgsOfSuper.add(simple(rawType(ta.toString())));
                }
                if (c.isInterface && ct.getExtendsClause() == null) {
                    // interfaces put "extends" in implements clause in the tree API
                }
                if (ct.getKind() == Tree.Kind.RECORD) c.kind = "record";
                if (ct.getKind() == Tree.Kind.ENUM) c.kind = "enum";
                allClasses.add(c);
                classesBySimple.putIfAbsent(c.name, c);
                classesBySimpleMulti.computeIfAbsent(c.name, k -> new ArrayList<>()).add(c);

                for (Tree member : ct.getMembers()) {
                    if (member instanceof VariableTree vt) {
                        String ft = rawType(vt.getType() == null ? "var" : vt.getType().toString());
                        c.fields.put(vt.getName().toString(), ft);
                        if (ct.getKind() == Tree.Kind.RECORD && !vt.getModifiers().getFlags().contains(Modifier.STATIC)) c.recordFields.add(new String[]{vt.getName().toString(), vt.getType().toString()});
                        if (vt.getModifiers().getFlags().contains(Modifier.STATIC) && vt.getInitializer() instanceof LiteralTree lt && lt.getValue() instanceof String sv) {
                            constants.put(c.name + "." + vt.getName(), sv);
                        }
                    }
                }
                for (Tree member : ct.getMembers()) {
                    if (member instanceof MethodTree mt) {
                        TreePath mp = new TreePath(getCurrentPath(), mt);
                        addMethod(c, mt, lines, docs, mp);
                    }
                }
                // record a type for output examples
                if (!c.recordFields.isEmpty() || (c.lombokData && !c.fields.isEmpty()) || c.annotations.contains("Entity")
                        || c.pkg.contains("Dto") || c.pkg.contains("dto") || c.name.endsWith("Dto") || c.name.endsWith("Response") || c.name.endsWith("Request")) {
                    Map<String, Object> t = new LinkedHashMap<>();
                    List<List<String>> fs = new ArrayList<>();
                    if (!c.recordFields.isEmpty()) for (String[] f : c.recordFields) fs.add(List.of(f[0], f[1]));
                    else for (VariableTree vt : ct.getMembers().stream().filter(x -> x instanceof VariableTree).map(x -> (VariableTree) x).toList()) {
                        if (vt.getModifiers().getFlags().contains(Modifier.STATIC)) continue;
                        fs.add(List.of(vt.getName().toString(), vt.getType().toString()));
                    }
                    t.put("fields", fs); t.put("file", c.file); t.put("svc", service);
                    types.putIfAbsent(c.name, t);
                }
                return super.visitClass(ct, c);
            }
        }.scan(cu, null);
    }

    static void addMethod(ClassInfo c, MethodTree mt, LineMap lines, DocTrees docs, TreePath path) {
        MethodInfo m = new MethodInfo();
        m.owner = c; m.tree = mt;
        m.name = mt.getName().toString().equals("<init>") ? c.name : mt.getName().toString();
        m.params = mt.getParameters().size();
        m.ret = mt.getReturnType() == null ? (m.name.equals(c.name) ? c.name : "void") : mt.getReturnType().toString();
        String params = mt.getParameters().stream().map(p -> p.getType() + " " + p.getName()).collect(Collectors.joining(", "));
        m.sig = (mt.getReturnType() == null ? "" : mt.getReturnType() + " ") + m.name + "(" + params + ")";
        m.line = (int) lines.getLineNumber(((com.sun.tools.javac.tree.JCTree) mt).getStartPosition());
        m.doc = firstSentence(docs, path);
        int overload = c.methods.getOrDefault(m.name, List.of()).size();
        m.id = "java:" + c.fqn + "#" + m.name + (overload > 0 ? "~" + overload : "");
        for (AnnotationTree a : mt.getModifiers().getAnnotations()) {
            String an = simple(a.getAnnotationType().toString());
            String args = a.getArguments().stream().map(Object::toString).collect(Collectors.joining(", "));
            m.annotations.add("@" + an + (args.isEmpty() ? "" : "(" + args + ")"));
            switch (an) {
                case "GetMapping", "PostMapping", "PutMapping", "DeleteMapping", "PatchMapping", "RequestMapping" -> {
                    m.httpMethod = an.equals("RequestMapping") ? requestMethod(a) : an.replace("Mapping", "").toUpperCase();
                    m.route = joinPath(c.basePath, annotationPath(a));
                }
                default -> {}
            }
        }
        BlockTree body = mt.getBody();
        m.trivial = body != null && body.getStatements().size() <= 1
                && (m.name.matches("(get|set|is|has)[A-Z].*") || m.name.equals("toString") || m.name.equals("hashCode") || m.name.equals("equals"));
        c.methods.computeIfAbsent(m.name, k -> new ArrayList<>()).add(m);
    }

    static void resolveKinds() {
        for (ClassInfo c : allClasses) {
            List<String> a = c.annotations;
            if (a.contains("RestController") || a.contains("Controller")) c.kind = "controller";
            else if (a.contains("Entity")) c.kind = "entity";
            else if (a.contains("Repository") || c.interfaces.stream().anyMatch(i -> i.endsWith("Repository")) || (c.isInterface && c.name.endsWith("Repository"))) c.kind = "repository";
            else if (a.contains("Service")) c.kind = "service";
            else if (a.contains("RestControllerAdvice") || a.contains("ControllerAdvice")) c.kind = "error-handler";
            else if (a.contains("Configuration")) c.kind = "config";
            else if (a.contains("Aspect")) c.kind = "aspect";
            else if (a.contains("Component")) c.kind = "component";
            else if (a.contains("SpringBootApplication")) c.kind = "app";
            else if (c.isInterface) c.kind = "interface";
            if (c.name.endsWith("Topology")) c.kind = "topology";
            if (c.kind.equals("entity") && c.tableName == null) c.tableName = snake(c.name);
        }
        // repositories: entity table from JpaRepository<Entity, Id>
        for (ClassInfo c : allClasses) {
            if (!c.kind.equals("repository")) continue;
            String entity = c.typeArgsOfSuper.isEmpty() ? null : c.typeArgsOfSuper.get(0);
            ClassInfo e = entity == null ? null : classesBySimple.get(entity);
            if (e != null && e.tableName != null) c.tableName = e.tableName;
        }
    }

    static Map<String, Object> node(MethodInfo m) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id", m.id); n.put("name", m.name); n.put("cls", m.owner.name); n.put("pkg", m.owner.pkg);
        n.put("svc", m.owner.service); n.put("file", m.owner.file); n.put("line", m.line);
        n.put("kind", m.annotations.stream().anyMatch(x -> x.startsWith("@KafkaListener")) ? "listener"
                : m.annotations.stream().anyMatch(x -> x.startsWith("@ExceptionHandler")) ? "error-handler"
                : m.annotations.stream().anyMatch(x -> x.startsWith("@Scheduled")) ? "scheduled"
                : m.route != null ? "endpoint" : m.owner.kind);
        n.put("sig", m.sig); n.put("ret", m.ret);
        if (m.doc != null) n.put("doc", m.doc);
        if (!m.annotations.isEmpty()) n.put("ann", m.annotations);
        if (m.route != null) { n.put("route", m.route); n.put("http", m.httpMethod); }
        if (m.trivial) n.put("trivial", true);
        if (m.owner.tableName != null && m.owner.kind.equals("repository")) n.put("table", m.owner.tableName);
        n.put("lang", "java");
        return n;
    }

    // ---------- pass 2: bodies ----------
    static void scanBodies(CompilationUnitTree cu, JavacTask task) {
        String file = rel(cu.getSourceFile().toUri().getPath());
        Map<String, String> staticImports = new HashMap<>();
        for (ImportTree it : cu.getImports()) if (it.isStatic()) {
            String q = it.getQualifiedIdentifier().toString();
            String[] parts = q.split("\\.");
            if (parts.length >= 2) staticImports.put(parts[parts.length - 1], parts[parts.length - 2]);
        }
        for (ClassInfo c : allClasses) {
            if (!c.file.equals(file)) continue;
            for (List<MethodInfo> ms : c.methods.values()) for (MethodInfo m : ms) {
                if (m.tree.getBody() == null) continue;
                scanMethod(m, staticImports, cu.getLineMap());
            }
        }
    }

    static void scanMethod(MethodInfo m, Map<String, String> staticImports, LineMap lines) {
        Map<String, String> locals = new HashMap<>();
        for (VariableTree p : m.tree.getParameters()) locals.put(p.getName().toString(), rawType(p.getType().toString()));
        int[] order = {0};
        Deque<String> ctx = new ArrayDeque<>(); // "catch" / "fallback"
        Set<String> seen = new HashSet<>();
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitVariable(VariableTree vt, Void v) {
                if (vt.getType() != null) {
                    String t = rawType(vt.getType().toString());
                    if (t.equals("var") && vt.getInitializer() instanceof NewClassTree nc) t = rawType(nc.getIdentifier().toString());
                    locals.put(vt.getName().toString(), t);
                }
                return super.visitVariable(vt, v);
            }

            @Override
            public Void visitTry(TryTree tt, Void v) {
                scan(tt.getResources(), v);
                scan(tt.getBlock(), v);
                for (CatchTree ct : tt.getCatches()) {
                    String types = ct.getParameter().getType().toString();
                    ctx.push("catch " + simple(types));
                    scan(ct.getBlock(), v);
                    ctx.pop();
                }
                if (tt.getFinallyBlock() != null) scan(tt.getFinallyBlock(), v);
                return null;
            }

            @Override
            public Void visitThrow(ThrowTree tt, Void v) {
                if (tt.getExpression() instanceof NewClassTree nc) {
                    String ex = simple(rawType(nc.getIdentifier().toString()));
                    edge(m.id, "exception:" + ex, "throws", ++order[0], ex, null);
                }
                return super.visitThrow(tt, v);
            }

            @Override
            public Void visitNewClass(NewClassTree nc, Void v) {
                String t = simple(rawType(nc.getIdentifier().toString()));
                ClassInfo target = classesBySimple.get(t);
                if (target != null && target.methods.containsKey(target.name)) {
                    MethodInfo ctor = target.methods.get(target.name).get(0);
                    edge(m.id, ctor.id, "call", ++order[0], "new " + t, ctx.peek());
                }
                return super.visitNewClass(nc, v);
            }

            @Override
            public Void visitMemberSelect(MemberSelectTree ms, Void v) {
                String key = ms.getExpression().toString() + "." + ms.getIdentifier();
                String k2 = simple(ms.getExpression().toString()) + "." + ms.getIdentifier();
                if (k2.startsWith("Topics.")) refs.add(new String[]{"topic", k2});
                return super.visitMemberSelect(ms, v);
            }

            final List<String[]> refs = new ArrayList<>();

            @Override
            public Void visitLiteral(LiteralTree lt, Void v) {
                if (lt.getValue() instanceof String s) {
                    sqlTables(s, m.id, order);
                    if (s.matches("(audio|shorts)/[a-z.\\-]+")) edge(m.id, "inngest:" + s, "inngest", ++order[0], "send " + s, ctx.peek());
                    String rk = redisKey(s);
                    if (rk != null) edge(m.id, "redis:" + rk, "redis", ++order[0], rk, ctx.peek());
                }
                return super.visitLiteral(lt, v);
            }

            @Override
            public Void visitMethodInvocation(MethodInvocationTree mi, Void v) {
                // scan receiver/args first so inner calls are ordered before the outer one
                super.visitMethodInvocation(mi, v);
                ExpressionTree sel = mi.getMethodSelect();
                String name; String recvType = null; boolean resolvedRecv = false; String recvText = null;
                if (sel instanceof MemberSelectTree ms) {
                    name = ms.getIdentifier().toString();
                    ExpressionTree recv = ms.getExpression();
                    recvText = recv.toString();
                    if (recv instanceof IdentifierTree id) {
                        String n = id.getName().toString();
                        if (locals.containsKey(n)) recvType = locals.get(n);
                        else if (fieldType(m.owner, n) != null) recvType = fieldType(m.owner, n);
                        else if (Character.isUpperCase(n.charAt(0))) recvType = n; // static
                        resolvedRecv = recvType != null;
                    } else if (recv instanceof MemberSelectTree inner && inner.getExpression().toString().equals("this")) {
                        recvType = fieldType(m.owner, inner.getIdentifier().toString());
                        resolvedRecv = recvType != null;
                    } else if (recv.toString().equals("this")) {
                        recvType = m.owner.name; resolvedRecv = true;
                    } else if (recv.toString().equals("super")) {
                        recvType = m.owner.superName; resolvedRecv = recvType != null;
                    }
                } else {
                    name = sel.toString();
                    if (staticImports.containsKey(name)) recvType = staticImports.get(name);
                    else recvType = m.owner.name;
                    resolvedRecv = true;
                }
                // topic usage with direction
                for (ExpressionTree arg : mi.getArguments()) {
                    String a = arg.toString();
                    Matcher tm = Pattern.compile("Topics\\.([A-Z_0-9]+)").matcher(a);
                    if (tm.find() && (arg instanceof MemberSelectTree || arg instanceof IdentifierTree)) {
                        String topic = constants.getOrDefault("Topics." + tm.group(1), "Topics." + tm.group(1));
                        String dir = switch (name) {
                            case "stream", "table", "globalTable" -> "consume";
                            default -> "produce";
                        };
                        if (name.equals("to") || name.equals("publish") || name.equals("send") || name.startsWith("write") || name.equals("stream") || name.equals("table") || name.equals("produce") || name.equals("emit") || name.equals("enqueue") || name.equals("sendDefault")) {
                            if (dir.equals("consume")) edge("topic:" + topic, m.id, "kafka", ++order[0], topic, null);
                            else edge(m.id, "topic:" + topic, "kafka", ++order[0], topic, ctx.peek());
                        }
                    }
                }
                List<MethodInfo> targets = resolve(recvType, name, mi.getArguments().size());
                if (!targets.isEmpty()) {
                    for (MethodInfo t : targets) {
                        String key = t.id + "@" + ctx.peek();
                        if (seen.add(key)) edge(m.id, t.id, "call", ++order[0], null, ctx.peek());
                    }
                } else if (recvType != null) {
                    ClassInfo rc = classesBySimple.get(simple(recvType));
                    if (rc != null && rc.kind.equals("repository") && rc.tableName != null) {
                        String mode = name.matches("(save|delete|insert|update|upsert|increment|decrement|mark|set|remove|add).*") ? "write" : "read";
                        edge(m.id, "table:" + rc.tableName, "db", ++order[0], mode + " via " + rc.name + "." + name, ctx.peek());
                    } else if (rc == null) {
                        String ext = externalOf(recvType, recvText, name);
                        if (ext != null && seen.add(ext + name)) edge(m.id, ext, ext.startsWith("redis") ? "redis" : ext.startsWith("s3") ? "s3" : "ext", ++order[0], simple(recvType) + "." + name, ctx.peek());
                    }
                } else if (!resolvedRecv && !COMMON.contains(name)) {
                    List<MethodInfo> cands = methodsByName.getOrDefault(name, List.of()).stream()
                            .filter(x -> x.params == mi.getArguments().size()).toList();
                    if (cands.size() == 1 && seen.add(cands.get(0).id)) edge(m.id, cands.get(0).id, "call", ++order[0], "guess", ctx.peek());
                }
                return null;
            }
        }.scan(m.tree.getBody(), null);
        // annotations: caches, listeners
        for (String a : m.annotations) {
            Matcher cm = Pattern.compile("@(Cacheable|CacheEvict|CachePut)\\((?:value\\s*=\\s*|cacheNames\\s*=\\s*)?\\{?\"([^\"]+)\"").matcher(a);
            if (cm.find()) edge(m.id, "redis:cache:" + cm.group(2), "redis", 0, cm.group(1).replace("Cacheable", "cache read-through").replace("CacheEvict", "cache evict"), null);
            if (a.startsWith("@KafkaListener")) {
                Matcher tm = Pattern.compile("Topics\\.([A-Z_0-9]+)").matcher(a);
                while (tm.find()) {
                    String topic = constants.getOrDefault("Topics." + tm.group(1), "Topics." + tm.group(1));
                    edge("topic:" + topic, m.id, "kafka", 0, topic, null);
                }
                Matcher lit = Pattern.compile("topics\\s*=\\s*\\{?\"([^\"]+)\"").matcher(a);
                while (lit.find()) edge("topic:" + lit.group(1), m.id, "kafka", 0, lit.group(1), null);
            }
            if (a.startsWith("@TransactionalEventListener") || a.startsWith("@EventListener")) {
                // listener for a Spring application event: param type
                if (!m.tree.getParameters().isEmpty()) {
                    String evt = simple(rawType(m.tree.getParameters().get(0).getType().toString()));
                    edge("springevent:" + evt, m.id, "event", 0, evt + (a.contains("AFTER_COMMIT") ? " (after commit)" : a.contains("BEFORE_COMMIT") ? " (before commit)" : ""), null);
                }
            }
            if (a.startsWith("@ExceptionHandler")) {
                Matcher em = Pattern.compile("([A-Z][A-Za-z]+)\\.class").matcher(a);
                while (em.find()) edge("exception:" + em.group(1), m.id, "fail", 0, "handled", null);
            }
        }
        // publishEvent(new X(...)) → spring event
        String body = m.tree.getBody().toString();
        Matcher pe = Pattern.compile("publishEvent\\(\\s*new\\s+([A-Za-z0-9_.]+)").matcher(body);
        while (pe.find()) edge(m.id, "springevent:" + simple(pe.group(1)), "event", 0, simple(pe.group(1)), null);
    }

    static String externalOf(String recvType, String recvText, String method) {
        String t = simple(recvType);
        if (t.contains("Redis") || t.equals("StringRedisTemplate") || t.contains("ValueOperations")) return "redis:client";
        if (t.startsWith("S3") ) return "s3:client";
        if (t.contains("Recombee") || t.equals("RecombeeClient")) return "ext:recombee";
        if (t.contains("Algolia") || t.equals("SearchClient")) return "ext:algolia";
        if (t.equals("KafkaTemplate")) return null;
        if (t.contains("JdbcClient") || t.contains("JdbcTemplate") || t.contains("EntityManager")) return null;
        if (t.contains("RestClient") || t.contains("HttpClient") || t.contains("WebClient")) return "ext:http";
        if (t.contains("JavaMailSender") || t.contains("Ses")) return "ext:mail";
        return null;
    }

    static final Pattern SQL = Pattern.compile("(?i)\\b(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|FROM|JOIN)\\s+([a-z_][a-z0-9_]*)");
    static final Set<String> NOT_TABLES = Set.of("set", "select", "where", "the", "unnest", "values", "lateral", "jsonb_array_elements", "generate_series", "now", "only");

    static void sqlTables(String s, String from, int[] order) {
        if (!s.matches("(?is).*\\b(select|insert|update|delete)\\b.*")) return;
        Matcher mm = SQL.matcher(s);
        Set<String> done = new HashSet<>();
        while (mm.find()) {
            String verb = mm.group(1).toUpperCase();
            String table = mm.group(2).toLowerCase();
            if (NOT_TABLES.contains(table) || !done.add(table + verb)) continue;
            String mode = verb.startsWith("INSERT") || verb.startsWith("UPDATE") || verb.startsWith("DELETE") ? "write" : "read";
            edge(from, "table:" + table, "db", ++order[0], mode + " (SQL)", null);
        }
    }

    static String redisKey(String s) {
        if (s.length() > 60 || s.contains(" ")) return null;
        if (s.matches("[a-z_]+(:[a-z_\\-]+)*:") || s.matches("(ratelimit|cooldown|blacklist|otp|auth|lyrics|user|geoip|admin|lake|mail)[:_][a-z_:\\-]*")) return s;
        return null;
    }

    static String fieldType(ClassInfo c, String name) {
        for (ClassInfo k = c; k != null; k = k.superName == null ? null : classesBySimple.get(k.superName)) {
            if (k.fields.containsKey(name)) return k.fields.get(name);
        }
        return null;
    }

    static List<MethodInfo> resolve(String type, String name, int argc) {
        if (type == null) return List.of();
        String t = simple(rawType(type));
        List<MethodInfo> found = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        Deque<String> q = new ArrayDeque<>(List.of(t));
        while (!q.isEmpty() && found.isEmpty()) {
            String cur = q.poll();
            if (!visited.add(cur)) continue;
            for (ClassInfo c : classesBySimpleMulti.getOrDefault(cur, List.of())) {
                List<MethodInfo> ms = c.methods.getOrDefault(name, List.of());
                List<MethodInfo> exact = ms.stream().filter(x -> x.params == argc).toList();
                found.addAll(exact.isEmpty() ? ms : exact);
                if (c.superName != null) q.add(c.superName);
                q.addAll(c.interfaces);
            }
        }
        // interface → single implementation
        List<MethodInfo> withImpl = new ArrayList<>(found);
        for (MethodInfo f : found) {
            if (!f.owner.isInterface) continue;
            List<ClassInfo> impls = allClasses.stream().filter(c -> c.interfaces.contains(f.owner.name) && !c.isInterface).toList();
            if (impls.size() <= 3) for (ClassInfo impl : impls) for (MethodInfo im : impl.methods.getOrDefault(name, List.of())) if (im.params == argc) withImpl.add(im);
        }
        return withImpl.size() > 4 ? withImpl.subList(0, 4) : withImpl;
    }

    static void edge(String s, String t, String kind, int order, String label, String ctx) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("s", s); e.put("t", t); e.put("k", kind);
        if (order > 0) e.put("o", order);
        if (label != null) e.put("l", label);
        if (ctx != null) { e.put("ctx", ctx); if (!kind.equals("fail")) e.put("onFail", true); }
        edges.add(e);
    }

    // ---------- helpers ----------
    static String firstSentence(DocTrees docs, TreePath path) {
        try {
            DocCommentTree d = docs.getDocCommentTree(path);
            if (d == null) return null;
            String s = d.getFullBody().stream().map(Object::toString).collect(Collectors.joining()).replaceAll("\\s+", " ").trim();
            return s.length() > 400 ? s.substring(0, 400) + "…" : s;
        } catch (Exception e) {
            return null;
        }
    }

    static String annotationPath(AnnotationTree a) {
        for (ExpressionTree arg : a.getArguments()) {
            if (arg instanceof AssignmentTree at) {
                String k = at.getVariable().toString();
                if (k.equals("value") || k.equals("path")) return firstString(at.getExpression());
            } else return firstString(arg);
        }
        return "";
    }

    static String annotationAttr(AnnotationTree a, String key) {
        for (ExpressionTree arg : a.getArguments()) if (arg instanceof AssignmentTree at && at.getVariable().toString().equals(key)) return firstString(at.getExpression());
        return null;
    }

    static String requestMethod(AnnotationTree a) {
        for (ExpressionTree arg : a.getArguments()) if (arg instanceof AssignmentTree at && at.getVariable().toString().equals("method")) {
            String v = at.getExpression().toString();
            Matcher m = Pattern.compile("(GET|POST|PUT|DELETE|PATCH)").matcher(v);
            if (m.find()) return m.group(1);
        }
        return "ANY";
    }

    static String firstString(ExpressionTree e) {
        Matcher m = Pattern.compile("\"([^\"]*)\"").matcher(e.toString());
        return m.find() ? m.group(1) : "";
    }

    static String joinPath(String a, String b) {
        String p = ("/" + (a == null ? "" : a) + "/" + (b == null ? "" : b)).replaceAll("/+", "/");
        return p.length() > 1 && p.endsWith("/") ? p.substring(0, p.length() - 1) : p;
    }

    static String rawType(String t) {
        int i = t.indexOf('<');
        return (i >= 0 ? t.substring(0, i) : t).replace("[]", "").trim();
    }

    static String simple(String t) {
        if (t == null) return null;
        int i = t.lastIndexOf('.');
        return i >= 0 ? t.substring(i + 1) : t;
    }

    static String snake(String s) {
        return s.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toLowerCase();
    }

    static final String ROOT = Path.of("").toAbsolutePath().toString() + "/";

    static String rel(String p) {
        return p.startsWith(ROOT) ? p.substring(ROOT.length()) : p;
    }

    // ---------- tiny JSON writer ----------
    static final class Json {
        static String write(Object o) {
            StringBuilder sb = new StringBuilder();
            w(sb, o);
            return sb.toString();
        }

        static void w(StringBuilder sb, Object o) {
            if (o == null) sb.append("null");
            else if (o instanceof String s) str(sb, s);
            else if (o instanceof Number || o instanceof Boolean) sb.append(o);
            else if (o instanceof Map<?, ?> m) {
                sb.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> e : m.entrySet()) {
                    if (!first) sb.append(',');
                    first = false;
                    str(sb, String.valueOf(e.getKey()));
                    sb.append(':');
                    w(sb, e.getValue());
                }
                sb.append('}');
            } else if (o instanceof Collection<?> c) {
                sb.append('[');
                boolean first = true;
                for (Object x : c) {
                    if (!first) sb.append(',');
                    first = false;
                    w(sb, x);
                }
                sb.append(']');
            } else if (o instanceof String[] arr) w(sb, Arrays.asList(arr));
            else str(sb, o.toString());
        }

        static void str(StringBuilder sb, String s) {
            sb.append('"');
            for (char ch : s.toCharArray()) {
                switch (ch) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    case '\n' -> sb.append("\\n");
                    case '\r' -> sb.append("\\r");
                    case '\t' -> sb.append("\\t");
                    default -> {
                        if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                        else sb.append(ch);
                    }
                }
            }
            sb.append('"');
        }
    }
}
