FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install ping dependency
RUN apt-get update && apt-get install -y iputils-ping && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN bun install

COPY src/ ./src/
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
