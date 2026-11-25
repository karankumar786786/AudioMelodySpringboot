# Architecture map

`architecture-map.html` is a single interactive page that covers the whole platform:

- **System:** the high-level design (clients, APIs, pipelines, data stores, deployment).
- **Services:** the low-level design of each service. It shows the layers, how the service runs, its switches, endpoints, tables, topics, Redis keys and Inngest events.
- **Flows:** the main journeys step by step, across services. These are playing a song, telemetry into Kafka and analytics, OTP sign-in, song upload, delete, shorts, the outbox and the analytics page.
- **Code graph:** every function in every service (about 3,500), searchable.
  - Hover a function to see its file and line, signature, docs and what its output looks like.
  - Double-click it to trace everything it sets off, in call order. The trace crosses HTTP, Kafka and Inngest hops into other services.
- **Data & events:** every Postgres table (from the Flyway migrations), Kafka topic, Redis key and outside service, with the functions that read and write it.
- **Failures:** what catches each kind of error, and every failure path found in the code.

Open `architecture-map.html` in a browser. It is self-contained, apart from Cytoscape and the fonts, which load from a CDN.

## Rebuilding it

Run this from the repo root after code changes:

```bash
node docs/architecture/gen/build.mjs
```

It needs Java 21+, Python 3.10+ and Node, plus `node_modules` installed in each TypeScript project, because it uses that project's own TypeScript compiler. To rebuild the page without re-reading the code (for example, after editing the template or overlay), run:

```bash
node docs/architecture/gen/build.mjs --reuse
```

## How it works

| File | What it does |
|---|---|
| `gen/JavaGraph.java` | Parses coreEngine, streams, communication and migration with the javac parser. Calls are resolved from the declared types of fields, parameters and locals. It also collects Spring routes, `@KafkaListener` topics, caches, SQL tables, Redis keys and exception handlers. |
| `gen/py_graph.py` | Reads adminBackend with Python's `ast`. It covers Django routes to views, ORM and SQL tables, Redis keys, Inngest events and `except` paths. |
| `gen/ts_graph.mjs` | Uses each TypeScript project's own compiler and type checker. It covers functions, components, hooks, JSX renders, axios and fetch calls, Inngest triggers, `step.invoke`/`sendEvent`, `onFailure` handlers and `catch` paths. |
| `gen/build.mjs` | Merges the three extractors' output. It matches each HTTP call to the endpoint that serves it, links producers to topics to consumers, Inngest events to the functions they trigger, code to tables, and exceptions to handlers. Then it writes the page. |
| `gen/overlay.json` | The hand-written layer: links the code can't show (injected callbacks, outbox rows relayed to topics, the Redis mail queue), the named flows, the failure catalogue and the per-service notes. The build prints any reference it can't find. |
| `gen/template.html` | The page itself. |

## Limits

- **Missing links:** calls made through reflection, dynamic imports or URLs built at runtime may be missing.
- **Faded links:** a link matched only by function name is drawn faded.
- **Unmatched HTTP calls:** these are listed on the Failures tab. Most are outside sites (Wikipedia, lrclib, ImageKit).
- **Output examples:** these are built from the return type's fields, with placeholder values, unless `overlay.json` gives a real example.
