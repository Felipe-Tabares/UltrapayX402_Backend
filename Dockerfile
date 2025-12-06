# Dockerfile para UltraPay Backend - Railway deployment
FROM node:20-alpine AS base

WORKDIR /app

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Copiar archivos de dependencias
COPY package.json package-lock.json* ./

# Instalar solo dependencias de produccion
RUN npm ci --only=production && npm cache clean --force

# Copiar codigo fuente
COPY src/ ./src/

# Usuario no-root para seguridad
USER node

# Puerto que Railway asignara via variable de entorno
EXPOSE 3001

# Usar dumb-init como PID 1 para manejo correcto de señales
CMD ["dumb-init", "node", "src/index.js"]
