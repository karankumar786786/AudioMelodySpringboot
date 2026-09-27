# ---------- Builder ----------
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .

RUN mvn dependency:go-offline

COPY src ./src

RUN mvn clean package -DskipTests


# ---------- Runner ----------
FROM eclipse-temurin:21-jre AS runner

WORKDIR /app

# Install curl for container health checks (tiny footprint)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root for security
RUN addgroup --system app && adduser --system --ingroup app app

# Copy only the generated JAR from builder
COPY --from=builder /app/target/*.jar app.jar

USER app

EXPOSE 9090

# Spring Boot Actuator health probe — permitted through Spring Security (permitAll).
# Used by Docker, Kubernetes liveness/readiness probes, and load balancers.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:9090/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]