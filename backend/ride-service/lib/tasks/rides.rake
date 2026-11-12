namespace :rides do
  desc "Inicia o consumidor assíncrono de eventos do RabbitMQ"
  task consumer: :environment do
    RabbitmqConsumer.start
  end

  desc "Verifica e processa corridas que excederam o tempo limite de aceite"
  task check_timeouts: :environment do
    timeout_threshold = 5.minutes.ago
    expired_rides = Ride.where(status: 'PENDING').where('created_at < ?', timeout_threshold)

    puts "[Rides Timeout] Encontradas #{expired_rides.count} corridas expiradas."

    expired_rides.find_each do |ride|
      puts "[Rides Timeout] Cancelando corrida ##{ride.id} por expiração de tempo limite..."
      ride.update(status: 'CANCELLED')
      $redis.set("ride:#{ride.id}:status", 'CANCELLED') rescue nil
      $redis.srem('pending_rides_set', ride.id.to_s) rescue nil

      # Notifica cliente e motoristas via WebSocket
      ClientRideChannel.broadcast_status_change(ride)
      DriverRidesChannel.broadcast_ride_taken(ride.id, nil)
    end
  end
end

