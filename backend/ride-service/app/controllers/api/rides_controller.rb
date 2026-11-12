module Api
  class RidesController < ApplicationController
    before_action :set_ride, only: [:show, :cancel, :complete]

    # GET /api/rides
    def index
      rides = Ride.all
      rides = rides.where(status: params[:status]) if params[:status].present? && params[:status] != 'ALL'
      rides = rides.where(user_id: params[:user_id]) if params[:user_id].present?
      
      if params[:driver_id].present? && params[:driver_id] != 'ALL'
        rides = rides.where(driver_id: params[:driver_id])
      end

      if params[:start_date].present?
        start_time = Time.zone.parse(params[:start_date]).beginning_of_day rescue nil
        rides = rides.where('created_at >= ?', start_time) if start_time.present?
      end

      if params[:end_date].present?
        end_time = Time.zone.parse(params[:end_date]).end_of_day rescue nil
        rides = rides.where('created_at <= ?', end_time) if end_time.present?
      end

      if params[:date].present? && params[:start_date].blank? && params[:end_date].blank?
        target_date = Date.parse(params[:date]) rescue nil
        if target_date.present?
          rides = rides.where(created_at: target_date.beginning_of_day..target_date.end_of_day)
        end
      end
      
      account_client = AccountServiceClient.new
      rides_json = rides.order(created_at: :desc).map do |r|
        r_json = r.as_json
        if r.driver_id.present?
          r_json['driver'] = account_client.find_user(r.driver_id) rescue nil
        end
        r_json
      end

      render json: rides_json, status: :ok
    end

    # GET /api/rides/:id
    def show
      # Tenta buscar status recente em cache no Redis
      cached_status = $redis.get("ride:#{@ride.id}:status") rescue nil
      ride_json = @ride.as_json
      ride_json['status'] = cached_status if cached_status.present?

      render json: ride_json, status: :ok
    end

    # POST /api/rides
    def create
      ride_params = params.require(:ride).permit(:user_id, :origin_address, :destination_address)

      # 1. Validação de comunicação East-West com Account Service (com suporte a cache/fallback)
      account_client = AccountServiceClient.new
      user_info = account_client.find_user(ride_params[:user_id])

      if user_info.nil?
        if account_client.service_unavailable?
          return render json: { 
            error: 'Serviço de validação de contas temporariamente indisponível. Tente novamente em instantes.' 
          }, status: :service_unavailable
        else
          return render json: { 
            error: "Usuário com identificador '#{ride_params[:user_id]}' não foi encontrado no Account Service." 
          }, status: :bad_request
        end
      end

      # 2. Inicialização e validação das regras de negócio
      @ride = Ride.new(ride_params)
      @ride.status = 'PENDING'

      if @ride.save
        # 3. Armazena estado no Redis
        begin
          $redis.set("ride:#{@ride.id}:status", 'PENDING')
          $redis.sadd('pending_rides_set', @ride.id.to_s)
        rescue StandardError => e
          Rails.logger.error("[Redis] Falha ao gravar corrida no Redis: #{e.message}")
        end

        # 4. Enfileira na fila do RabbitMQ
        RabbitmqService.publish_ride_created(@ride)

        # 5. Notifica motoristas disponíveis em tempo real via WebSocket
        DriverRidesChannel.broadcast_new_ride(@ride)

        render json: @ride, status: :created
      else
        render json: { errors: @ride.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # POST /api/rides/:id/accept
    def accept
      driver_id = params[:driver_id]

      if driver_id.blank?
        return render json: { error: 'O identificador do motorista (driver_id) é obrigatório.' }, status: :bad_request
      end

      # Valida se o motorista existe no Account Service (com suporte a cache/fallback)
      account_client = AccountServiceClient.new
      driver_info = account_client.find_user(driver_id)
      if driver_info.nil?
        if account_client.service_unavailable?
          return render json: { 
            error: 'Serviço de validação de contas temporariamente indisponível. Tente novamente em instantes.' 
          }, status: :service_unavailable
        else
          return render json: { error: "Motorista '#{driver_id}' não encontrado no Account Service." }, status: :bad_request
        end
      end

      service = AcceptRideService.new(params[:id], driver_id)
      result = service.execute

      if result.success?
        ride_json = result.ride.as_json
        ride_json['driver'] = driver_info
        render json: {
          message: 'Corrida aceita com sucesso!',
          ride: ride_json
        }, status: :ok
      else
        render json: { error: result.error_message }, status: result.status_code
      end
    end

    # POST /api/rides/:id/cancel
    def cancel
      if @ride.status == 'COMPLETED'
        return render json: { error: 'Não é possível cancelar uma corrida já concluída.' }, status: :unprocessable_entity
      end

      cancelled_by = params[:cancelled_by].presence || 'CLIENT'
      reason = params[:reason]

      @ride.update(status: 'CANCELLED')
      $redis.set("ride:#{@ride.id}:status", 'CANCELLED') rescue nil
      $redis.srem('pending_rides_set', @ride.id.to_s) rescue nil

      # Notifica cliente e motoristas em tempo real via WebSocket
      ClientRideChannel.broadcast_cancellation(@ride, cancelled_by, reason)
      DriverRidesChannel.broadcast_ride_cancelled(@ride, cancelled_by, reason)
      DriverRidesChannel.broadcast_ride_taken(@ride.id, nil)

      render json: { message: 'Corrida cancelada.', ride: @ride, cancelled_by: cancelled_by }, status: :ok
    end

    # POST /api/rides/:id/complete
    def complete
      if @ride.status != 'IN_PROGRESS'
        return render json: { error: 'Apenas corridas em andamento podem ser concluídas.' }, status: :unprocessable_entity
      end

      driver_id = params[:driver_id].presence || @ride.driver_id
      if driver_id.present? && @ride.driver_id.present? && @ride.driver_id != driver_id
        return render json: { error: 'Esta corrida está atribuída a outro motorista.' }, status: :forbidden
      end

      @ride.update(status: 'COMPLETED', driver_id: driver_id || @ride.driver_id)
      $redis.set("ride:#{@ride.id}:status", 'COMPLETED') rescue nil
      $redis.srem('pending_rides_set', @ride.id.to_s) rescue nil

      # Busca informações do motorista para enriquecer o retorno
      account_client = AccountServiceClient.new
      driver_info = account_client.find_user(@ride.driver_id) rescue nil

      # Notifica cliente e motoristas em tempo real
      ClientRideChannel.broadcast_completion(@ride, driver_info)
      DriverRidesChannel.broadcast_ride_completed(@ride, driver_info)

      render json: {
        message: 'Corrida concluída com sucesso!',
        ride: @ride.as_json.merge('driver' => driver_info)
      }, status: :ok
    end

    private

    def set_ride
      @ride = Ride.find(params[:id])
    end
  end
end

