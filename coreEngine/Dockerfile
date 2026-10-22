# ---------- Builder ----------
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Download official OpenTelemetry Java instrumentation agent in builder
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

COPY pom.xml .

RUN mvn dependency:go-offline

# Copy source code into builder stage for compiling and testing
COPY src ./src

# Package standalone executable JAR (unit tests run in CI workflow)
RUN mvn clean package -DskipTests


# ---------- Runner (Ubuntu 24.04 LTS Noble - Rock-Solid Mirror Stability) ----------
FROM eclipse-temurin:21-jre-noble AS runner

WORKDIR /app

# Install curl for container health checks with retry resilience
RUN apt-get update -o Acquire::Retries=3 --fix-missing \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root for security
RUN addgroup --system app && adduser --system --ingroup app app

# Copy ONLY the generated JAR and OpenTelemetry Java agent from builder
COPY --from=builder /app/target/*.jar app.jar
COPY --from=builder /app/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar

USER app

EXPOSE 9090

# Spring Boot Actuator health probe — permitted through Spring Security (permitAll).
# Used by Docker, Kubernetes liveness/readiness probes, and load balancers.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:9090/actuator/health || exit 1

ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]