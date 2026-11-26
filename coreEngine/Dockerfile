# Repo ke root se build karo (image ko communication/ module bhi chahiye):
#   docker build -f coreEngine/Dockerfile .
# ---------- Builder stage: code compile karke JAR banata hai ----------
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# OpenTelemetry Java agent download karo (traces/metrics ke liye, code badle bina)
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

# Pehle sirf pom files copy - taaki jab tak pom na badle, dependencies ka download Docker cache se ho jaaye.
COPY pom.xml .
COPY communication/pom.xml communication/
COPY coreEngine/pom.xml coreEngine/
COPY streams/pom.xml streams/
RUN mvn -q -pl coreEngine -am dependency:go-offline -DexcludeArtifactIds=communication || true

COPY communication/src communication/src
COPY coreEngine/src coreEngine/src

# Chalne layak JAR banao (tests CI me chalte hain, yahan skip)
RUN mvn -B -pl coreEngine -am clean package -DskipTests


# ---------- Runner stage: sirf JAR chalane wali chhoti image (Ubuntu 24.04) ----------
FROM eclipse-temurin:21-jre-noble AS runner

WORKDIR /app

# Health check ke liye curl install karo (fail ho to retry)
RUN apt-get update -o Acquire::Retries=3 --fix-missing \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Security ke liye root user se nahi, normal user se chalao
RUN addgroup --system app && adduser --system --ingroup app app

# Builder stage se SIRF JAR aur OpenTelemetry agent copy karo (source code nahi)
COPY --from=builder /app/coreEngine/target/*.jar app.jar
COPY --from=builder /app/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar

USER app

EXPOSE 9090

# Health check: /actuator/health (Spring Security me sabke liye khula hai).
# Docker / load balancer isse dekhte hain ki app zinda hai ya nahi.
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:9090/actuator/health || exit 1

ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]
