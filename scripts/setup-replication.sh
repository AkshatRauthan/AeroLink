#!/bin/bash
# Run this ONCE after `docker compose -f docker-compose.dev.yml up -d`
# Sets up GTID-based replication between each shard's primary and replica.

set -e

echo "Waiting for MySQL containers to be healthy..."
sleep 15

setup_replication() {
  PRIMARY_CONTAINER=$1
  REPLICA_CONTAINER=$2
  REPL_USER="repl"
  REPL_PASS="replpass"

  echo "Configuring replication: $PRIMARY_CONTAINER -> $REPLICA_CONTAINER"

  # Create replication user on primary (if not exists)
  docker exec -i "$PRIMARY_CONTAINER" mysql -uroot -proot -e "
    CREATE USER IF NOT EXISTS '${REPL_USER}'@'%' IDENTIFIED WITH mysql_native_password BY '${REPL_PASS}';
    GRANT REPLICATION SLAVE ON *.* TO '${REPL_USER}'@'%';
    FLUSH PRIVILEGES;
  "

  # Point replica at primary using GTID auto-positioning
  docker exec -i "$REPLICA_CONTAINER" mysql -uroot -proot -e "
    STOP REPLICA;
    CHANGE REPLICATION SOURCE TO
      SOURCE_HOST='${PRIMARY_CONTAINER}',
      SOURCE_USER='${REPL_USER}',
      SOURCE_PASSWORD='${REPL_PASS}',
      SOURCE_AUTO_POSITION=1;
    START REPLICA;
  "

  echo "Replication status for $REPLICA_CONTAINER:"
  docker exec -i "$REPLICA_CONTAINER" mysql -uroot -proot -e "SHOW REPLICA STATUS\G" | grep -E "Replica_IO_Running|Replica_SQL_Running|Last_Error"
}

setup_replication mysql-shard0-primary mysql-shard0-replica
setup_replication mysql-shard1-primary mysql-shard1-replica

echo ""
echo "Replication setup complete."
echo "Verify with: docker exec -i mysql-shard0-replica mysql -uroot -proot -e 'SHOW REPLICA STATUS\G'"
echo "Look for: Replica_IO_Running: Yes / Replica_SQL_Running: Yes"