# Go Data Generator Service

## Purpose

The Go Data Generator is an external simulator for an airline inventory/feed
provider. It produces realistic flight-catalogue events without making AeroLink
dependent on a paid, rate-limited, or unreliable third-party API during
development.

It is deliberately separate from the AeroLink monorepo. The useful architectural
boundary is the Kafka event contract, not the implementation language.

```text
Today
Go Data Generator ──> Kafka ──> Flight Service

Later
Airline APIs ──> Go ingestion adapter ──> Kafka ──> Flight Service
```

The Flight Service should not need to change when the simulated provider is
replaced with real airline API adapters, provided both publish the same
versioned Kafka event contracts.

## Responsibilities

The generator is responsible for:

- creating realistic airport, route, flight, schedule, and price data;
- publishing versioned events to Kafka;
- simulating regular updates, short bursts, and failure conditions;
- providing deterministic scenarios for repeatable local tests.

The generator is not responsible for:

- handling customer requests;
- creating bookings or payments;
- deciding whether a seat can be sold;
- writing directly to any AeroLink service database.

## Data Ownership and Event Flow

```text
Go Data Generator
       │
       │ flight catalogue / schedule / price events
       ▼
     Kafka
       │
       ▼
Flight Service ──> Flight catalogue and search projection

Booking Service ──> Seat allocation, booking lifecycle, idempotency, outbox
```

After Booking Service owns a seat map, it is authoritative for live seat
allocation. The generator may seed initial inventory if needed, but it must not
continuously overwrite seat availability after customers begin booking.

If raw provider payloads need to be retained later, an ingestion adapter may
archive them in object storage for replay/auditing. It must still not write
directly into Flight Service or Booking Service databases.

## Kafka Event Contract

Every event should contain an envelope that allows consumers to deduplicate,
order, trace, and evolve messages safely.

```json
{
    "eventId": "018f...",
    "eventType": "flight.price.updated",
    "schemaVersion": 1,
    "occurredAt": "2026-08-07T12:00:00.000Z",
    "correlationId": "018f...",
    "flightId": "flight_123",
    "payload": {
        "currency": "INR",
        "price": "6499.00"
    }
}
```

Use `flightId` as the Kafka message key. Kafka then sends updates for a flight
to the same partition and preserves their order within that partition.

Consumers must still be idempotent. An event may be delivered more than once,
and events can be delayed or arrive out of order across partitions.

Suggested topics:

| Topic                           | Event examples                                  | Primary consumer |
| ------------------------------- | ----------------------------------------------- | ---------------- |
| `flight.data.generated`         | flight created, schedule updated, route updated | Flight Service   |
| `price.updated`                 | price increased/decreased                       | Flight Service   |
| `inventory.seeded` _(optional)_ | initial seat-map seed only                      | Booking Service  |

## Traffic Profiles

The goal is to simulate useful workload patterns, not to generate unrealistic
volume that only consumes local resources.

| Mode     |                                 Suggested rate | Purpose                                                 |
| -------- | ---------------------------------------------: | ------------------------------------------------------- |
| `seed`   |             500–2,000 flights over 1–2 minutes | Populate local Flight and optional Booking projections. |
| `normal` |                             1–5 updates/second | Continuous price, schedule, gate, and delay changes.    |
| `burst`  |       50–100 updates/second for 30–120 seconds | Test consumer lag, batching, and recovery.              |
| `chaos`  | Variable rate with invalid delivery conditions | Test idempotency, retries, and observability.           |

Recommended initial data set:

- 50–100 airports
- 200–500 routes
- 1,000–2,000 upcoming flights
- 100–200 seats per flight only when realistic Booking seed data is needed

Suggested event mix:

```text
70% price changes
20% schedule or status updates
8% flight additions
1–2% cancellations or major delays
occasional duplicates, delayed events, and out-of-order events
```

## Determinism and Failure Simulation

The service should support a fixed random seed so the same scenario can be
replayed when debugging a consumer bug.

Chaos mode should deliberately generate:

- duplicate event IDs/messages;
- delayed events;
- out-of-order events for different flights;
- temporary burst traffic;
- malformed payloads sent only to a dedicated test topic, when validating
  dead-letter or validation handling.

Do not use malformed events in the normal development topic by default; they
make day-to-day development unnecessarily noisy.

## Inputs and Controls

The generator may accept inputs for operational control. These inputs configure
simulation behaviour; they are not customer-facing business commands.

Start with environment variables or CLI flags:

```env
GEN_MODE=normal
EVENTS_PER_SECOND=5
SEED=42
```

Useful controls include:

- mode: `seed`, `normal`, `burst`, or `chaos`;
- event rate and burst duration;
- airport/route/date-range selection;
- deterministic seed;
- pause/resume;
- targeted injection of a price surge, delay, cancellation, duplicate, or
  delayed event.

When live controls become useful, expose a small protected admin API:

```text
POST /admin/scenarios
POST /admin/pause
POST /admin/resume
POST /admin/inject-delay
```

This API must be internal/admin-only. It must not accept booking requests or
modify Booking Service’s live seat state.

## Configuration Example

```env
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_FLIGHTS=flight.data.generated
KAFKA_TOPIC_PRICES=price.updated

GEN_MODE=normal
EVENTS_PER_SECOND=5
SEED=42
AIRPORT_COUNT=75
ROUTE_COUNT=300
UPCOMING_FLIGHT_COUNT=1500
```

## Acceptance Checks

- [ ] Events include `eventId`, `eventType`, `schemaVersion`, `occurredAt`, and `flightId`.
- [ ] Kafka messages are keyed by `flightId`.
- [ ] A fixed seed reproduces the same generated scenario.
- [ ] Flight Service can safely process duplicates and delayed events.
- [ ] The generator never writes directly to another service’s database.
- [ ] Booking remains authoritative for live seat allocation.
- [ ] Admin controls are protected and cannot be used as public business APIs.
