require 'bunny'
require 'json'

class RabbitmqService
  QUEUE_NAME = 'rides_queue'.freeze
  RABBITMQ_URL = ENV.fetch('RABBITMQ_URL', 'amqp://guest:guest@rabbitmq:5672')

  def self.publish_ride_created(ride)
    return if Rails.env.test? && ENV['DISABLE_RABBITMQ_IN_TEST'] != 'false'

    begin
      connection = Bunny.new(RABBITMQ_URL)
      connection.start

      channel = connection.create_channel
      queue = channel.queue(QUEUE_NAME, durable: true)

      payload = {
        event: 'RIDE_CREATED',
        ride_id: ride.id,
        user_id: ride.user_id,
        origin_address: ride.origin_address,
        destination_address: ride.destination_address,
        status: ride.status,
        created_at: ride.created_at
      }.to_json

      queue.publish(payload, persistent: true, content_type: 'application/json')
      Rails.logger.info("[RabbitMQ] Mensagem publicada na fila #{QUEUE_NAME} para corrida ##{ride.id}")

      connection.close
      true
    rescue StandardError => e
      Rails.logger.error("[RabbitMQ] Erro de comunicação com a fila: #{e.class} - #{e.message}")
      false
    end
  end
end

