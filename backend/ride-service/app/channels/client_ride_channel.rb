class ClientRideChannel < ApplicationCable::Channel
  def subscribed
    if params[:ride_id].present?
      stream_from "client_ride_#{params[:ride_id]}"
      Rails.logger.info("[ActionCable] Cliente monitorando corrida ##{params[:ride_id]}")
    elsif params[:user_id].present?
      stream_from "client_user_#{params[:user_id]}"
      Rails.logger.info("[ActionCable] Cliente monitorando eventos do usuário #{params[:user_id]}")
    else
      reject
    end
  end

  def unsubscribed
    Rails.logger.info("[ActionCable] Cliente encerrou conexão com canal da corrida")
  end

  def self.broadcast_status_change(ride, driver_info = nil, extra_payload = {})
    payload = {
      event: 'RIDE_STATUS_UPDATED',
      ride_id: ride.id,
      status: ride.status,
      driver_id: ride.driver_id,
      driver: driver_info,
      updated_at: ride.updated_at
    }.merge(extra_payload)

    # Transmite no canal específico da corrida
    ActionCable.server.broadcast("client_ride_#{ride.id}", payload)

    # Transmite também no canal do usuário cliente
    ActionCable.server.broadcast("client_user_#{ride.user_id}", payload)
  end

  def self.broadcast_cancellation(ride, cancelled_by = 'CLIENT', reason = nil)
    payload = {
      event: 'RIDE_CANCELLED',
      ride_id: ride.id,
      status: 'CANCELLED',
      driver_id: ride.driver_id,
      cancelled_by: cancelled_by,
      reason: reason,
      updated_at: ride.updated_at
    }

    # Transmite no canal específico da corrida
    ActionCable.server.broadcast("client_ride_#{ride.id}", payload)

    # Transmite também no canal do usuário cliente
    ActionCable.server.broadcast("client_user_#{ride.user_id}", payload)
  end

  def self.broadcast_completion(ride, driver_info = nil)
    payload = {
      event: 'RIDE_COMPLETED',
      ride_id: ride.id,
      status: 'COMPLETED',
      driver_id: ride.driver_id,
      driver: driver_info,
      updated_at: ride.updated_at
    }

    # Transmite no canal específico da corrida
    ActionCable.server.broadcast("client_ride_#{ride.id}", payload)

    # Transmite também no canal do usuário cliente
    ActionCable.server.broadcast("client_user_#{ride.user_id}", payload)
  end
end

