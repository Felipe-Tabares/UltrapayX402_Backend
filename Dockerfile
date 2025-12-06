FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar código fuente
COPY src/ ./src/

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001

# Puerto
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Iniciar servidor
CMD ["node", "src/index.js"]
