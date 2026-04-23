# ---- Stage 1: Install dependencies & build ----
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package files first (for better caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of your source code
COPY . .

# Build the Next.js app
RUN npm run build

# ---- Stage 2: Run the production app ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run the app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose the port Next.js runs on
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
