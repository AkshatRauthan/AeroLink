# AeroLink — Flight Booking Backend: System Design & Architecture

> A production-grade distributed flight booking backend built as a personal project to demonstrate real-world backend engineering across microservices, distributed systems, messaging, and cloud infrastructure.

---

## Tech Stack

| Layer              | Technology                                             |
| ------------------ | ------------------------------------------------------ |
| Primary Language   | Node.js + TypeScript                                   |
| Database           | MySQL (sharded) via Knex.js                            |
| Cache              | Redis (ElastiCache on AWS)                             |
| Async Messaging    | RabbitMQ (notifications), Kafka (flight data pipeline) |
| Deployment         | AWS EC2 + RDS, Oracle Cloud (messaging infra)          |
| Containerisation   | Docker + Docker Compose                                |
| Secrets Management | AWS Secrets Manager                                    |

---

## Services (6–7 Microservices)

> The Data Generation Service is a **separate Go project** — AeroLink owns 6–7 services. In production, Kafka would be fed by an actual airline inventory API; the Go service simulates that external boundary.

### 1. API Gateway / Reverse Proxy Service

- **Custom-built in Node.js** — no Nginx, no Kong
- Path-based routing to upstream microservices
- Inline auth-server validation before forwarding any request
- **IP-based + path-based rate limiting**
- Authentication and authorization enforcement at the edge

### 2. Auth Service

- JWT issue, validation, refresh
- Called via **gRPC** by all internal services (low latency, typed contracts)
- Owns user identity and session management

### 3. Flight Service

- Flight catalog and search projection management
- Consumes flight events from **Kafka** (published by Data Generation Service)
- Owns flight metadata/search data only; it does not query or mutate Booking Service tables

### 4. Booking Service

- Core booking logic — the most critical service
- Implements **Pessimistic Concurrency Control** (`SELECT FOR UPDATE`) for high-contention seats
- Implements **Optimistic Concurrency Control** (version column check) for low-contention scenarios
- Owns seat inventory, bookings, idempotency records, and its transactional outbox
- Resolves the correct Booking MySQL shard before every operation
- Publishes `booking.confirmed` from its transactional outbox after successful booking
- Invalidates Redis cache post-write

### 5. Payment Service

- Mock payment processing
- Idempotency keys to prevent duplicate charge on retry

### 6. Notification Service

- Consumes `booking.confirmed` events from **RabbitMQ**
- Handles email and push notifications
- **Retry logic + Dead Letter Queue (DLQ)** for fault-tolerant delivery
- Completely async — client gets 200 OK before notification is sent

### 7. Data Generation Service _(external — separate Go project)_

- Standalone Go service — not part of the AeroLink monorepo
- CRON-based flight data generator (routes, prices, seat inventory, departure times)
- Publishes high-volume flight events to **Kafka**
- Simulates real airline inventory systems / external airline inventory feed
- Allows price fluctuation simulation over time
- In production, this role is fulfilled by an actual airline inventory API feed — the Go service simulates that boundary

### 8. Search Service _(optional / can be merged with Flight Service)_

- Advanced flight filtering
- Elasticsearch or MySQL full-text search

---

## Communication Patterns

| Type                                    | Protocol    | When                                  |
| --------------------------------------- | ----------- | ------------------------------------- |
| Client → Gateway                        | REST (HTTP) | All external requests                 |
| Gateway → Auth Service                  | gRPC        | JWT validation (sync, low latency)    |
| Gateway → Downstream Services           | REST        | Proxied requests                      |
| Booking → Notification                  | RabbitMQ    | Async post-booking events             |
| External Data Gen (Go) → Flight Service | Kafka       | High-throughput flight data streaming |
| Any service needing immediate response  | REST / gRPC | Synchronous calls                     |

**Decision rationale:**

- **Kafka** for the flight data pipeline — high throughput, message replay, multiple consumers
- **RabbitMQ** for notifications — task queue semantics, once consumed = done, retry + DLQ support
- **gRPC** for internal auth calls — typed, fast, no HTTP overhead
- No queue for synchronous operations (e.g. seat availability check) — REST/gRPC only

---

## Data Layer

### Data Ownership and Access Boundaries

Database access is local to the owning service. `shared` provides only generic
Knex creation and transaction helpers; it exposes neither pools nor shard
routing. No service imports another service’s repository or database manager.

| Service              | Owns                                              | Access rule                                     |
| -------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Booking Service      | seats, bookings, idempotency keys, booking outbox | The only service with Booking shard credentials |
| Flight Service       | flight catalog and search projections             | Cannot access Booking shards                    |
| Auth Service         | identities and sessions                           | Own database/schema when implemented            |
| Payment Service      | payment attempts/provider references              | Own database/schema when implemented            |
| Notification Service | delivery preferences and delivery attempts        | Own database/schema when implemented            |

This prevents a shared database from becoming an implicit distributed monolith.
A service obtains another domain’s data through an API or event-derived
projection, never through a direct SQL query.

### MySQL Sharding

- Booking Service has two identical logical shards: `aerolink_booking_shard0`
  and `aerolink_booking_shard1`.
- **Shard key:** `flight_id` — ensures all seat inventory and bookings for the
  same flight land on the same shard, which is critical for pessimistic locking.
- Sharding logic lives in `services/booking-service/src/infrastructure/db/booking-shard.router.ts`.
- `hash(flightId) % BOOKING_SHARD_COUNT` resolves the Booking Service-owned pool.
- The shard count and hash strategy are a stable contract. Adding a shard later
  requires an explicit resharding migration.

### Read / Write Replicas

- **Write primary** — all INSERT / UPDATE / DELETE operations, idempotency
  checks, and checkout reads.
- **Read replica (×1 per shard)** — stale-tolerant reads only, such as a
  seat-map browse or booking-history page.
- A booking decision never uses a replica: checkout reads the seat and performs
  `SELECT ... FOR UPDATE` on the resolved shard’s primary in one transaction.
- Connection pools are managed by Booking Service in
  `services/booking-service/src/infrastructure/db/booking-db.manager.ts`.
- Hosted on **AWS RDS** with native read replica support

### Redis Caching

- Seat availability cached with TTL-based expiry
- Cache invalidated immediately after a successful booking write
- **Circuit breaker** on external price feed failures — falls back to last cached state

### Query Builder: Knex.js

Chosen over Prisma and raw `mysql2` because:

- Manual shard routing requires direct connection pool control (Prisma fights this)
- Built-in transaction management (`knex.transaction(async trx => { ... })`)
- Full SQL visibility — no ORM magic hiding query plans
- Uses `mysql2` as the underlying driver

---

## Folder Structure (Feature-based / Modular)

```
services/
  booking-service/
    src/
      infrastructure/db/
        booking-shard.config.ts    # Booking’s two primary/replica pairs
        booking-shard.router.ts    # hash(flightId) → Booking shard
        booking-db.manager.ts      # Booking-only Knex pools
        migrations/                # runs once per Booking shard schema
      modules/booking/
        booking.repository.ts
        outbox.repository.ts
shared/
  src/db/
    knex.factory.ts                # generic client creation only
    transaction.ts                 # generic transaction helper
  src/cache/
  src/messaging/
  src/errors/
  src/utils/
```

**Why feature-based over MVC:**

- All domain logic lives together — easy to navigate and delete
- Each microservice is already small; MVC folders add zero organisational value
- Scales cleanly — new domain = new folder, nothing else changes
- Matches NestJS conventions — immediately recognisable to any Node backend engineer

---

## DB Connection Manager Pattern

```ts
// Booking Service: infrastructure/db/booking-shard.router.ts
const getBookingShard = (flightId: string) => {
    const index = hash(flightId) % BOOKING_SHARD_COUNT;
    return getBookingShardPool(index);
};

// Browse-only read; stale data is acceptable here.
const { replica } = getBookingShard(flightId);
const seats = await replica("seats").where({ flight_id: flightId });

// Checkout reads and writes on the primary, in one transaction.
const { primary } = getBookingShard(flightId);
await primary.transaction(async (trx) => {
    const seat = await trx("seats")
        .where({ flight_id: flightId, seat_no: seatNo })
        .forUpdate(); // pessimistic lock

    if (!seat.available) throw new Error("SEAT_TAKEN");

    await trx("seats").where({ id: seat.id }).update({ available: false });
    await trx("bookings").insert({ user_id: userId, flight_id: flightId });
    await trx("booking_outbox").insert({
        event_type: "booking.confirmed",
        aggregate_id: bookingId,
        payload: JSON.stringify({ bookingId, flightId, userId }),
    });
});
```

**Rule:** every service talks only to the database it owns, through its own
repository. `shared/db` supplies generic mechanics but never an application
database topology or domain access.

### Booking Schema and Migration Workflow

Both Booking shards have the same schema: `seats`, `bookings`,
`idempotency_keys`, and `booking_outbox`. The outbox record is inserted in the
same primary transaction as a booking; a separate publisher delivers it to
RabbitMQ and marks it published. This prevents a committed booking from losing
its event if the broker is temporarily unavailable.

The migration runner lives at
`services/booking-service/src/infrastructure/db/migrate.ts` and iterates only
over Booking primaries. MySQL replication distributes schema changes to the
matching replicas. Run it locally with:

```bash
pnpm --filter @aerolink/booking-service db:migrate
```

For local development, start one MySQL server with separate schemas, then
migrate. Replication is intentionally disabled:

```bash
pnpm dev:env:up
pnpm --filter @aerolink/booking-service db:migrate
```

---

## Deployment Architecture

| Component                        | Platform                                               |
| -------------------------------- | ------------------------------------------------------ |
| App services (all microservices) | AWS EC2 (Docker Compose)                               |
| MySQL shards + read replicas     | AWS RDS                                                |
| Redis                            | AWS ElastiCache                                        |
| Kafka + RabbitMQ                 | Oracle Cloud (always-free, 4 OCPUs / 24GB RAM, Docker) |
| Secrets                          | AWS Secrets Manager                                    |

**Cross-cloud communication:**

- Oracle Cloud firewall rules allow inbound from AWS EC2 IPs only
- Kafka: SASL authentication
- RabbitMQ: username/password auth
- All credentials fetched from AWS Secrets Manager at startup — never hardcoded

**Why this split:**

- Oracle Cloud's always-free tier (4 OCPUs / 24GB RAM) is ideal for running Kafka + RabbitMQ containers
- Keeps AWS bill low
- Services treat both as network endpoints — cloud provider is irrelevant to the app layer

---

## Secrets Management

```ts
// secrets.ts — runs once at service startup
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "ap-south-1" });

export const getSecret = async (secretName: string) => {
    const response = await client.send(
        new GetSecretValueCommand({ SecretId: secretName }),
    );
    return JSON.parse(response.SecretString!);
};
```

- EC2 instances use IAM roles — no hardcoded AWS credentials anywhere
- Secret rotation enabled on Secrets Manager
- Oracle Cloud service credentials (Kafka/RabbitMQ) also stored in AWS Secrets Manager — single source of truth

---

## Problems Being Solved

### Core Domain Problems

| Problem                                                         | Solution                                                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Two users booking the same seat simultaneously                  | Pessimistic locking (`SELECT FOR UPDATE`) on high-contention flights, optimistic locking (version column) on low-contention ones |
| User initiates booking but never pays — seat locked forever     | CRON-based expiry releases unpaid bookings after X minutes, re-increments seat count, invalidates cache                          |
| Client retries failed request, creates duplicate booking        | Idempotency keys checked before processing any booking                                                                           |
| Booking succeeds but payment fails — orphaned confirmed booking | Saga pattern with compensating transactions to rollback booking on payment failure                                               |
| Stale seat availability data causes overselling                 | Redis cache with immediate post-write invalidation + TTL                                                                         |
| Flight cancellation — seat never re-released                    | Cancel → refund → re-release seat → invalidate cache → notify user (full reverse booking flow)                                   |

### Search & Data Problems

| Problem                                                                | Solution                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| High read load on flight search crushing the DB                        | Read replicas + Redis caching with TTL                                                                          |
| No external flight data API — can't seed real data                     | Separate Go data generation service publishing synthetic flights to Kafka — simulates an airline inventory feed |
| Prices never change — unrealistic simulation                           | Data Generation Service simulates price fluctuation over time                                                   |
| Cache stampede — multiple requests hit DB simultaneously on cache miss | Single-flight pattern / mutex on cache population                                                               |

### Infrastructure Problems

| Problem                                                 | Solution                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Popular routes overload one MySQL shard                 | `flight_id` shard key with consistent hashing distributes load evenly                |
| Too many services opening too many DB connections       | Tuned pool size limits per service in Knex config                                    |
| Cross-cloud communication (AWS ↔ Oracle) is insecure    | IP whitelisting + Kafka SASL auth + RabbitMQ credentials from AWS Secrets Manager    |
| Credentials scattered across `.env` files in production | AWS Secrets Manager as single source of truth, fetched at startup via IAM role       |
| Running Knex migrations across N shards consistently    | Migration runner that iterates all shard connections in sequence                     |
| Service crashes mid-transaction                         | Graceful shutdown — `SIGTERM` handler drains in-flight requests before process exits |

### Reliability & Observability Problems

| Problem                                            | Solution                                                              |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| RabbitMQ message dropped — notification never sent | Retry logic + Dead Letter Queue on Notification Service               |
| External price feed goes down                      | Circuit breaker falls back to last cached Redis state                 |
| Impossible to trace a request across 7+ services   | `x-request-id` generated at gateway, propagated through every service |
| Gateway routes to dead/unhealthy instances         | `/health` endpoint on every service                                   |

### Security Problems

| Problem                                    | Solution                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Unauthenticated requests reaching services | JWT validation at gateway — no request forwarded without valid token |
| DDoS / API abuse                           | IP-based + path-based rate limiting at proxy layer                   |
| Hardcoded credentials in codebase          | IAM roles on EC2 + AWS Secrets Manager — zero credentials in code    |

---

## Key Design Decisions Summary

| Decision              | Choice                                                      | Reason                                                        |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Shard key             | `flight_id`                                                 | All bookings for a flight on one shard — required for locking |
| Concurrency control   | Pessimistic (high contention) + Optimistic (low contention) | Prevents duplicate seat booking                               |
| Cache invalidation    | Immediate post-write                                        | Prevents stale seat availability reads                        |
| Notification delivery | Async via RabbitMQ                                          | Client doesn't wait; fault-tolerant with DLQ                  |
| Flight data pipeline  | Kafka                                                       | High throughput, replay, multiple consumers                   |
| Query builder         | Knex.js                                                     | Transaction support + manual shard routing                    |
| Folder structure      | Feature-based / Modular                                     | Domain cohesion, scales cleanly                               |
| Secrets               | AWS Secrets Manager                                         | Single source of truth across AWS + Oracle Cloud              |
| Deployment            | AWS (app + DB) + Oracle (messaging)                         | Cost-efficient, both clouds on resume                         |
