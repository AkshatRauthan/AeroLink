//  Kafka — high-throughput event streaming (flight data, price updates)
export * as KafkaTopics from "./kafka/kafka.topics";
export * as KafkaClient from "./kafka/kafka.client";
export * as KafkaConsumer from "./kafka/kafka.consumer";
export * as KafkaPublisher from "./kafka/kafka.publisher";


//  RabbitMQ — task-queue semantics (booking confirmation, notifications)
export * as RebbitMQConfig from "./rabbitmq/queue.config";
export * as RabbitMQClient from "./rabbitmq/rabbitmq.client";
export * as RabbitMQConsumer from "./rabbitmq/queue.consumer";
export * as RabbitMQPublisher from "./rabbitmq/queue.publisher";