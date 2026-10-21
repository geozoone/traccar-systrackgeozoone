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

EXPOSE 3000

# --host 0.0.0.0 es imprescindible para que el puerto 3000 sea
# accesible desde fuera del contenedor (en el VPS nginx proxiea a él)
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
