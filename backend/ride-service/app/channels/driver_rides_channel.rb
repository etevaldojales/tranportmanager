class DriverRidesChannel < ApplicationCable::Channel
  CHANNEL_NAME = 'driver_rides_channel'.freeze

  def subscribed
    stream_from CHANNEL_NAME
    Rails.logger.info("[ActionCable] Motorista conectado ao canal de corridas disponíveis")
  end

  def unsubscribed
    Rails.logger.info("[ActionCable] Motorista desconectado do canal de corridas")
  end

  def self.broadcast_new_ride(ride)
    ActionCable.server.broadcast(CHANNEL_NAME, {
      event: 'NEW_RIDE_AVAILABLE',
      ride: ride.as_json
    })
  end

  def self.broadcast_ride_taken(ride_id, driver_id)
    ActionCable.server.broadcast(CHANNEL_NAME, {
      event: 'RIDE_TAKEN',
      ride_id: ride_id,
      driver_id: driver_id
    })
  end

  def self.broadcast_ride_cancelled(ride, cancelled_by = nil, reason = nil)
    ActionCable.server.broadcast(CHANNEL_NAME, {
      event: 'RIDE_CANCELLED',
      ride_id: ride.id,
      driver_id: ride.driver_id,
      status: 'CANCELLED',
      cancelled_by: cancelled_by,
      reason: reason
    })
  end

  def self.broadcast_ride_completed(ride, driver_info = nil)
    ActionCable.server.broadcast(CHANNEL_NAME, {
      event: 'RIDE_COMPLETED',
      ride_id: ride.id,
      driver_id: ride.driver_id,
      driver: driver_info,
      status: 'COMPLETED'
    })
  end
end

