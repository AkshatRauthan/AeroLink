# AeroLink ✈️

> A backend engineering playground for building the awkward, failure-prone,
> surprisingly fun parts of a flight-booking system.

## What AeroLink Is (and Very Much Is Not)

AeroLink is **not** trying to become the next production booking platform. It
does not sell real flights, charge real cards, or promise that your imaginary
window seat will survive a network partition.

It is a learning project built around the real engineering problems that make
backend work interesting:

- two people trying to reserve the same seat at once;
- a client retrying a request at the worst possible moment;
- a database transaction succeeding while a broker is unavailable;
- messages arriving twice, late, or in an order chosen by chaos itself;
- services owning their data without becoming a distributed monolith;
- scaling reads without letting stale data sell the same seat twice.

The objective is to learn the trade-offs, implement the safety rails, and be
able to explain *why* each decision exists. Production-grade aspirations,
portfolio-project budget, and a healthy respect for distributed systems are all
welcome here.

## The Project in One Picture

```text
                     ┌───────────────────────────┐
                     │    Go Data-Gen Service    │
                     │ (simulates airline feeds) │
                     └──────────────┬────────────┘
                                  Kafka
                                    │
                                    ▼
Client ──REST──> API Gateway ──> Flight Service
                    │                    │
                    │                    ▼
                    │              Flight projection
                    │
                    ├──────────────> Auth Service (gRPC)
                    │
                    └──────────────> Booking Service ──> Booking database
                                                │
                                                │ transactional outbox
                                                ▼
                                             RabbitMQ
                                                │
                                                ▼
                                      Notification Service
```

Payment Service fits into the Booking lifecycle as the project grows. It is
shown in the repository because payments are where idempotency stops being a
nice word and starts being a personality trait.

## Architecture at a Glance

| Area | Choice | Why it is interesting |
|---|---|---|
| Language | Node.js + TypeScript | Product-facing services stay quick to build and strongly typed. |
| Synthetic provider | Go Data Generator | Simulates an external airline feed without coupling the project to a real API. |
| External API | REST through API Gateway | A single edge for routing, authentication, CORS, and rate limiting. |
| Internal auth | gRPC | Typed, low-latency service-to-service token validation. |
| Flight-event stream | Kafka | Replayable, partitioned event stream for catalogue and price updates. |
| Notification work | RabbitMQ | Durable task-queue semantics with retry and DLQ support. |
| Relational data | MySQL + Knex | Explicit SQL, transactions, locks, and direct topology control. |
| Cache | Redis | Read optimisation and rate-limit counters, never booking truth. |
| Database ownership | Service-owned schemas/users | Stops "shared DB" from quietly becoming the real monolith. |

## Services and Ownership

| Service | Owns | Main job |
|---|---|---|
| API Gateway | Edge concerns | Routes requests and becomes the security/rate-limit boundary. |
| Auth Service | Identity and sessions | Issues and validates JWTs. |
| Flight Service | Flight catalogue/search projection | Consumes provider events and serves flight discovery. |
| Booking Service | Seats, bookings, idempotency, outbox | Protects seat allocation and runs the booking lifecycle. |
| Payment Service | Payment attempts/provider references | Handles idempotent payment processing when implemented. |
| Notification Service | Notification preferences/delivery attempts | Sends asynchronous booking updates. |
| Go Data Generator *(external)* | Synthetic provider behaviour | Publishes realistic and occasionally annoying flight events. |

## The Hard Problems This Project Is Built to Explore

### Seat allocation under contention

Booking uses `flight_id` as its logical shard key. Every seat and booking for a
flight resolves to the same Booking shard, allowing checkout to use one MySQL
transaction and `SELECT ... FOR UPDATE` safely.

```text
flight_id ──hash──> booking_shard0 or booking_shard1
                         │
                         └── lock seat → create booking → write outbox event
```

The important rule: cache state and stale replica data never decide whether a
seat can be sold. The authoritative Booking database does.

### Reliable events after a database write

Booking creation eventually needs to write both a booking record and a
`booking.confirmed` event. A direct database-write-then-publish flow can lose
the event if RabbitMQ is down at exactly the wrong moment—because of course it
will be down at exactly the wrong moment.

The intended solution is a **transactional outbox**:

```text
Booking transaction
├── update seat / create booking
└── insert booking_outbox event

Outbox publisher ──> RabbitMQ ──> Notification consumer
```

### Idempotency

Clients retry. Brokers redeliver. Payment providers retry. Networks make
confident liars out of timeout errors. Idempotency keys and consumer-side
deduplication make those retries safe rather than expensive.

### Event ordering and bad days

Kafka messages are keyed by `flightId` to preserve order for a flight within a
partition. Consumers still need to handle duplicates, delayed events, and
out-of-order events across partitions. The data generator exists partly to make
these problems show up on purpose instead of only in a postmortem.

## Database Model

### Default local development

Use one local MySQL server/container with separate schemas:

```text
mysql-dev
├── aerolink_booking_shard0
├── aerolink_booking_shard1
├── aerolink_auth
├── aerolink_flight
├── aerolink_payment
└── aerolink_notification
```

The Booking schemas are **logical shards** on the same local MySQL server.
They keep routing and data-ownership code honest without demanding a small
data-centre from a development laptop.

Local replicas are disabled by default:

```env
BOOKING_READ_REPLICA_ENABLED=false
```

The multi-instance primary/replica setup remains an optional advanced exercise
for testing replication lag, read routing, failover, and migration propagation.

### Service boundaries

- Booking Service alone accesses Booking schemas.
- Flight Service owns its catalogue/search data.
- Auth, Payment, and Notification get their own schemas and credentials as
  they acquire persistence needs.
- Services exchange data through APIs and events—not through someone else’s
  database connection string.

Read the full explanation in [Database Architecture](docs/Database_Architecture.md).

## Go Data Generator

The Go generator is a fake airline provider today and can become an API
ingestion adapter tomorrow:

```text
Today:  Go generator ──> Kafka ──> Flight Service
Later:  Airline APIs ──> Go adapter ──> Kafka ──> Flight Service
```

Suggested profiles:

| Mode | Suggested rate | Use |
|---|---:|---|
| `seed` | 500–2,000 flights over 1–2 minutes | Populate local projections. |
| `normal` | 1–5 events/second | Routine price and schedule updates. |
| `burst` | 50–100 events/second for 30–120 seconds | Consumer/backpressure testing. |
| `chaos` | Variable with duplicates and delays | Idempotency and observability testing. |

It may accept protected operational controls—mode, rate, seed, pause/resume,
and injected delays/cancellations—but it must not accept booking requests or
overwrite Booking Service’s live seat allocation.

More detail: [Data Generator Service](docs/Data_Generator_Service.md).

## Repository Layout

```text
services/
├── gateway-service/
├── auth-service/
├── flight-service/
├── booking-service/
│   └── src/infrastructure/db/   # Booking-owned routing, pools, migrations
├── payment-service/
└── notification-service/

shared/
├── src/cache/
├── src/db/                      # generic mechanics only; no service topology
├── src/errors/
├── src/messaging/
├── src/proto/
└── src/utils/

docs/
├── AeroLink_System_Design.md
├── Database_Architecture.md
└── Data_Generator_Service.md
```

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker and Docker Compose
- A local MySQL server/container configured with the schemas above

### Start supporting infrastructure

```bash
pnpm install
pnpm dev:env:up
```

This starts the current local messaging/cache dependencies: Kafka, RabbitMQ,
Kafka UI, and Redis. Configure MySQL separately using the local schema model
above, then create the Booking Service environment file:

```bash
cp services/booking-service/.env.example services/booking-service/.env
pnpm --filter @aerolink/booking-service db:migrate
```

The project is intentionally being built in vertical slices. Some service entry
points and domain modules are scaffolding rather than finished product flows;
that is normal here, not a hidden launch countdown.

## Documentation

- [System Design](docs/AeroLink_System_Design.md) — broader service, messaging,
  security, and deployment decisions.
- [Database Architecture](docs/Database_Architecture.md) — ownership, logical
  Booking shards, migrations, replicas, and operational rules.
- [Data Generator Service](docs/Data_Generator_Service.md) — simulated airline
  feed, Kafka contracts, traffic profiles, and chaos controls.

## Learning Roadmap

The most useful order is to finish one safe path before inviting more services
to the party:

1. Booking transaction with seat lock and unique constraints.
2. Idempotent booking creation.
3. Transactional outbox and reliable notification publication.
4. Notification consumer deduplication, retry, and DLQ behaviour.
5. Payment state machine and booking compensation flow.
6. Gateway authentication, authorization, rate limits, and timeouts.
7. Observability: correlation IDs, structured logs, metrics, traces.
8. Load, failure, and concurrency tests—because confidence is nice, evidence is nicer.

## A Final Note

The value of AeroLink is not the number of microservices in the tree. It is the
quality of the decisions you can justify when things fail in inconvenient,
perfectly realistic ways. If a design choice makes a failure easier to reason
about, recover from, and explain in an interview, it belongs here.
