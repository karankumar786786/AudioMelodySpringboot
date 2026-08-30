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

# Copy only the generated JAR from builder
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 9090

ENTRYPOINT ["java", "-jar", "app.jar"]