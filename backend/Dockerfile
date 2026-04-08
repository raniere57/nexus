FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Tools required for preset checkers:
# - curl: cURL preset
# - iputils-ping: Ping preset  
# - openssh-client + sshpass: SSH remote execution
# - netcat-openbsd: TCP port check preset (nc)
# - dnsutils: DNS lookup preset (dig)
RUN apt-get update && apt-get install -y \
    curl \
    iputils-ping \
    openssh-client \
    sshpass \
    netcat-openbsd \
    dnsutils \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN bun install

COPY src/ ./src/
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
