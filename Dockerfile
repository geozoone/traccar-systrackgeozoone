# ============================================================
# Frontend GeoZoone (React + Vite, puerto 3000)
# Réplica del arranque actual del VPS (pm2 -> "npm start" -> vite)
# con los proxies /api y /modulo redirigidos a los contenedores
# (variables TRACCAR_API_URL / TRACCAR_WS_URL / MODULO_URL en compose).
# ============================================================
FROM node:18-bullseye

WORKDIR /app

# Dependencias primero (aprovecha la caché de capas).
# ⚠️ .npmrc ES IMPRESCINDIBLE aquí: activa legacy-peer-deps
# (sin él, npm moderno rechaza @mui/styles + React 18)
COPY package.json package-lock.json .npmrc ./
RUN npm install

COPY . .

# Compilar bundle optimizado y minificado de producción (carpeta /app/build)
RUN npm run build

EXPOSE 3000

# Servir el build de producción en el puerto 3000 conservando los proxies (/api, /api/socket y /modulo)
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
