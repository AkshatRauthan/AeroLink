# AeroLink Database Architecture

This document describes how AeroLink stores data, routes Booking requests, and
uses primary/replica databases safely. The design keeps service ownership clear
while allowing Booking to scale independently when that becomes necessary.

## Principles

1. A service owns its data. Another service never reads or writes that data
   with direct SQL.
2. Database topology belongs to the service that owns the data; it is not
   exposed from the shared package.
3. The primary database is authoritative. Cache and replicas are optimisations,
   never the source of truth for a booking decision.
4. Sharding is an exception for demonstrated scale or contention, not a default
   for every service.
5. Infrastructure replication is configured by MySQL locally and by the cloud
   provider in production. Application code does not copy data between nodes.

## Data Ownership

| Service | Owns | Sharding decision | Replication decision |
|---|---|---|---|
| Booking Service | seats, bookings, idempotency keys, booking outbox | **Yes:** two shards, routed by `flight_id` | **Yes:** one primary and one optional read replica per shard. Enable replica reads only when provisioned and healthy. |
| Flight Service | flight catalogue and search projection | **No initially.** Use one database; revisit only when catalogue/search scale proves it necessary. | **No initially.** Add a read replica only if search reads overload the primary. |
| Auth Service | users, credentials, refresh sessions | **No.** Identity data should remain in one database with strong constraints. | **No initially.** Add a replica only for demonstrated read pressure; authentication-sensitive reads stay on the primary. |
| Payment Service | payment attempts and provider references | **No.** Prioritise idempotency and auditability over partitioning. | **No initially.** A future reporting replica must never handle payment state transitions. |
| Notification Service | delivery preferences and delivery attempts | **No.** Queue consumers provide horizontal throughput. | **No initially.** Add one only if notification history/reporting becomes read-heavy. |

Each service has a dedicated database/schema and a dedicated database user with
permissions only for that service’s data. For example, `booking_service` can
access `aerolink_booking_shard0` and `aerolink_booking_shard1`; it cannot access
Auth or Payment data.

Logical database ownership does not require one MySQL server per service during
early development. Separate schemas and credentials are enough. Physical server
isolation can be introduced later when a service needs independent scaling or
failure isolation.

## Booking Database Topology

Booking is the only initially sharded domain because seat allocation is both
write-heavy and contention-sensitive. The shard key is `flight_id`.

```text
                        
Client booking request ────────────────────────────┐
                                                   │ (hash(flight_id)%2)
              ┌────────────────────────────────────┴────────────────────────────────────┐
              │                                                                         │
              ▼                                                                         ▼
     Booking shard 0                                                       Booking shard 1
  aerolink_booking_shard0                                              aerolink_booking_shard1
              │                                                                         │
      ┌───────┴────────┐                                                       ┌────────┴────────┐
      ▼                ▼                                                       ▼                 ▼
   primary          replica                                                 primary           replica
 reads/writes     browse reads                                            reads/write       browse reads
```

All seats and bookings for one `flight_id` land on the same shard. This is
essential: a seat lock and the resulting booking write must occur inside one
transaction on one MySQL primary.

The routing implementation is local to Booking Service:

```text
services/booking-service/src/infrastructure/db/
├── booking-shard.config.ts    connection configuration for both shards
├── booking-shard.router.ts    hash(flight_id) → shard index
├── booking-db.manager.ts      Booking-only Knex pools
├── migrate.ts                 primary-only migration runner
└── migrations/                Booking-owned schema changes
```

The shared package contains only reusable mechanics such as a generic Knex
factory and transaction helper. It does not expose Booking pool objects,
connection strings, shard routing, migrations, or repositories.

## Primary and Replica Rules

### Always use the primary

Use the shard primary for every operation that needs current, authoritative
state:

- `INSERT`, `UPDATE`, and `DELETE`
- seat selection during checkout
- `SELECT ... FOR UPDATE`
- idempotency-key creation and lookup
- payment/booking state transitions
- transactional outbox writes
- an immediate read after a write (read-your-writes)
- migrations

### Replica reads are optional

Use a replica only when stale data is acceptable:

- browsing a seat map before checkout
- booking history
- reporting and administrative views

Never decide whether a seat can be sold based on a replica result. Replication
is asynchronous, so a replica can temporarily show a seat as available after
another request has already booked it on the primary.

`BOOKING_READ_REPLICA_ENABLED=false` is the recommended local default. When it
is disabled, stale-tolerant reads use the relevant primary. Enable it only once
replica endpoints are provisioned and verified.

If a replica becomes unavailable or is excessively delayed, the application
must fall back to the corresponding primary for reads. Correctness takes
priority over read scaling.

## Booking Transaction

The checkout path resolves the shard once and keeps all state changes in a
single primary transaction.

```ts
const { primary } = getBookingShard(flightId);

await primary.transaction(async (trx) => {
  const seat = await trx('seats')
    .where({ flight_id: flightId, seat_no: seatNo })
    .forUpdate()
    .first();

  if (!seat?.available) throw new Error('SEAT_TAKEN');

  await trx('seats').where({ id: seat.id }).update({ available: false });
  await trx('bookings').insert(booking);
  await trx('booking_outbox').insert(bookingConfirmedEvent);
});
```

The transaction prevents concurrent requests from selling the same seat. The
outbox insert is in the same transaction, so a committed booking cannot lose
its event merely because RabbitMQ is temporarily unavailable.

## Booking Schema

Every Booking shard has the same schema.

| Table | Purpose |
|---|---|
| `seats` | Seat inventory for flights assigned to that shard; includes availability and versioning fields. |
| `bookings` | Booking lifecycle state: `PENDING`, `CONFIRMED`, `FAILED`, `EXPIRED`, or `CANCELLED`. |
| `idempotency_keys` | Prevents duplicate booking creation when clients retry a request. |
| `booking_outbox` | Events committed with booking changes and published asynchronously. |

There are no cross-shard foreign keys or transactions. A workflow that spans
multiple services uses events and a saga/state-machine design instead.

## Local Development

Default local development uses **one MySQL server/container**, not a container
per shard or a replica pair. It contains separate schemas for each service:

```text
mysql-dev
├── aerolink_booking_shard0
├── aerolink_booking_shard1
├── aerolink_auth
├── aerolink_flight
├── aerolink_payment
└── aerolink_notification
```

Booking’s two shard configurations use the same host and port but different
database names. Other services receive separate credentials restricted to their
own schema(s). This preserves service ownership and deterministic Booking shard
routing without consuming the memory required for several MySQL instances.

There is no local replication setup in the default environment:

```env
BOOKING_READ_REPLICA_ENABLED=false
```

Run Booking migrations against both logical Booking databases:

```bash
pnpm install
cp services/booking-service/.env.example services/booking-service/.env
pnpm dev:env:up
pnpm --filter @aerolink/booking-service db:migrate
```

The multi-instance primary/replica Docker topology and
`setup-replication.sh` are an optional advanced test environment. Use them only
when testing replica routing, replication lag, failover behaviour, or migration
propagation.

## Managed Production

Production should use managed database replication, for example AWS RDS or
Aurora. Provision a primary and optional read replica for each Booking shard:

```text
Booking shard 0: managed primary + managed read replica
Booking shard 1: managed primary + managed read replica
```

The provider handles binary-log replication, backups, patching, replica repair,
and failover operations. Do not run the local Docker replication script or
manually execute `CHANGE REPLICATION SOURCE TO` in production.

The application still owns query routing, read-your-writes behavior, primary
fallback, migration targeting, and monitoring of replica lag.

## Migration Rules

1. A Booking migration runs against **both Booking primaries**, sequentially.
2. Replicas receive the schema change through MySQL replication.
3. Never run a migration directly against a replica.
4. Make migrations backward-compatible before deploying code that requires the
   new schema.
5. Treat a shard-count change as a dedicated data-migration project, not a
   normal schema migration.

Run local Booking migrations with:

```bash
pnpm --filter @aerolink/booking-service db:migrate
```

## Scaling Decision Guide

Do not shard every service database. Start with one primary per service, add a
read replica only for demonstrated read pressure, and shard only when a single
primary cannot meet a service’s data size, write throughput, or isolation need.

Booking has a natural shard key and locking boundary (`flight_id`), so its
two-shard design is reasonable. Auth, Payment, and Notification should remain
unsharded until metrics demonstrate otherwise.

## Operational Checklist

- [ ] Every service has separate credentials and only its own database access.
- [ ] Booking checkout and idempotency paths use the resolved shard primary.
- [ ] Replica use is limited to stale-tolerant reads.
- [ ] Replica failures fall back to the matching primary.
- [ ] Booking migrations run on primaries only.
- [ ] Booking writes create outbox records in the same transaction.
- [ ] Outbox publishers and event consumers are idempotent.
- [ ] Replica lag, connection pool usage, lock waits, and outbox age are monitored.
- [ ] Shard count and hash strategy are treated as stable contracts.
