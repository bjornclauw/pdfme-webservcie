FROM node:20-alpine

LABEL org.opencontainers.image.description="PDFme Webservice - Access Swagger UI at http://localhost:6439/api-docs"
LABEL org.opencontainers.image.url="http://localhost:6439/api-docs"
LABEL org.opencontainers.image.documentation="http://localhost:6439/api-docs"
LABEL com.docker.desktop.extension.api.version="http://localhost:6439/api-docs"

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 6439

CMD ["node", "src/index.js"]