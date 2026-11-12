require 'bunny'
require 'json'

class RabbitmqConsumer
  QUEUE_NAME = 'rides_queue'.freeze
  RABBITMQ_URL = ENV.fetch('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq:5672')

  def self.start
    Rails.logger.info("[RabbitmqConsumer] Iniciando consumidor de filas RabbitMQ...")
    connection = Bunny.new(RABBITMQ_URL)
    connection.start

    channel = connection.create_channel
    queue = channel.queue(QUEUE_NAME, durable: true)

    # Processa mensagens da fila de corridas
    queue.subscribe(manual_ack: true, block: true) do |delivery_info, properties, payload|
      begin
        data = JSON.parse(payload)
        Rails.logger.info("[RabbitmqConsumer] Processando evento #{data['event']} para corrida ##{data['ride_id']}")

        ride = Ride.find_by(id: data['ride_id'])
        if ride && ride.pending?
          # Registra no Redis que o pedido foi enfileirado e está aguardando motorista
          $redis.sadd('pending_rides_set', ride.id.to_s) rescue nil
        end

        channel.ack(delivery_info.delivery_tag)
      rescue StandardError => e
        Rails.logger.error("[RabbitmqConsumer] Erro ao processar mensagem: #{e.message}")
        # Rejeita e recoloca na fila (requeue) para reprocessamento
        channel.nack(delivery_info.delivery_tag, false, true)
      end
    end
  rescue Interrupt => _
    connection.close
  rescue StandardError => e
    Rails.logger.error("[RabbitmqConsumer] Falha na conexão com RabbitMQ: #{e.message}")
  end
end

