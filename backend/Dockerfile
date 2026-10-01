# ---- JYM Culture backend - production image ----
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so this layer is cached between builds
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy the application
COPY . .

# Run as the built-in non-root user
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "server.js"]
