# Repo ke root se build karo (image ko communication/ module bhi chahiye):
#   docker build -f streams/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

COPY pom.xml .
COPY communication/pom.xml communication/
COPY coreEngine/pom.xml coreEngine/
COPY streams/pom.xml streams/
RUN mvn -q -pl streams -am dependency:go-offline -DexcludeArtifactIds=communication || true

COPY communication/src communication/src
COPY streams/src streams/src
RUN mvn -q -pl streams -am clean package -DskipTests

FROM eclipse-temurin:21-jre-noble AS runner
WORKDIR /app
RUN apt-get update -o Acquire::Retries=3 --fix-missing \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /var/lib/streams && chown app:app /var/lib/streams

COPY --from=builder /app/streams/target/streams-*.jar app.jar
COPY --from=builder /app/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar

USER app
ENV STREAMS_STATE_DIR=/var/lib/streams \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"
EXPOSE 8095
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD curl -f http://localhost:8095/actuator/health || exit 1
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]
