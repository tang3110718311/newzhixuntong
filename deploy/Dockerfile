ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/ai-provider/package.json packages/ai-provider/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci
RUN python3 -m pip install --no-cache-dir --break-system-packages edge-tts==7.2.8 \
  || python3 -m pip install --no-cache-dir edge-tts==7.2.8

FROM deps AS builder
ARG NEXT_PUBLIC_API_BASE_URL=http://171.111.198.77:14000/api
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --no-cache-dir --break-system-packages edge-tts==7.2.8 \
  || python3 -m pip install --no-cache-dir edge-tts==7.2.8

COPY --from=builder /app /app

EXPOSE 3000 4000
