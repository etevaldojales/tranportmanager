class AcceptRideService
  Result = Struct.new(:success?, :ride, :error_message, :status_code)

  LOCK_TIMEOUT = 10 # segundos de validade do lock

  def initialize(ride_id, driver_id)
    @ride_id = ride_id
    @driver_id = driver_id
  end

  def execute
    lock_key = "lock:ride:#{@ride_id}"

    # 1. Tenta adquirir o Lock Distribuído Atômico no Redis (SET ... NX PX)
    lock_acquired = acquire_redis_lock(lock_key, @driver_id, LOCK_TIMEOUT)

    unless lock_acquired
      return Result.new(false, nil, 'Esta corrida está sendo processada por outro motorista.', :conflict)
    end

    begin
      # 2. Localiza a corrida no banco
      ride = Ride.find_by(id: @ride_id)
      unless ride
        return Result.new(false, nil, 'Corrida não encontrada.', :not_found)
      end

      # 3. Verifica se a corrida ainda está PENDENTE
      # Verifica tanto o cache do Redis quanto o banco de dados
      cached_status = $redis.get("ride:#{@ride_id}:status")
      if cached_status.present? && cached_status != 'PENDING'
        return Result.new(false, nil, 'Esta corrida já foi aceita por outro motorista.', :conflict)
      end

      if ride.status != 'PENDING'
        return Result.new(false, nil, 'Esta corrida já foi aceita ou cancelada.', :conflict)
      end

      # 4. Transação no banco de dados para vincular motorista e atualizar status
      ActiveRecord::Base.transaction do
        ride.update!(status: 'IN_PROGRESS', driver_id: @driver_id)
      end

      # 5. Persiste estado no Redis para consultas ultrarrápidas
      $redis.set("ride:#{ride.id}:status", 'IN_PROGRESS')
      $redis.set("ride:#{ride.id}:driver_id", @driver_id)
      $redis.hset("ride:#{ride.id}:details", {
        'id' => ride.id,
        'user_id' => ride.user_id,
        'driver_id' => @driver_id,
        'origin_address' => ride.origin_address,
        'destination_address' => ride.destination_address,
        'status' => 'IN_PROGRESS',
        'updated_at' => ride.updated_at.to_s
      })
      $redis.srem('pending_rides_set', ride.id.to_s)

      # 6. Busca dados do motorista para enriquecer o payload em tempo real
      account_client = AccountServiceClient.new
      driver_info = account_client.find_user(@driver_id)

      # 7. Dispara notificações em tempo real via WebSocket
      ClientRideChannel.broadcast_status_change(ride, driver_info)
      DriverRidesChannel.broadcast_ride_taken(ride.id, @driver_id)

      Result.new(true, ride, nil, :ok)
    rescue ActiveRecord::RecordInvalid => e
      Result.new(false, nil, e.message, :unprocessable_entity)
    rescue StandardError => e
      Rails.logger.error("[AcceptRideService] Erro inesperado: #{e.class} - #{e.message}\n#{e.backtrace.first(5).join("\n")}")
      Result.new(false, nil, 'Erro interno ao aceitar corrida.', :internal_server_error)
    ensure
      # Libera o lock atômico
      release_redis_lock(lock_key, @driver_id)
    end
  end

  private

  def acquire_redis_lock(key, value, timeout_seconds)
    # SET key value NX EX timeout
    $redis.set(key, value, nx: true, ex: timeout_seconds)
  rescue Redis::BaseError => e
    Rails.logger.error("[Redis Lock] Erro ao conectar ao Redis: #{e.message}")
    # Fallback seguro: se o Redis estiver indisponível, recusa por garantia de concorrência
    false
  end

  def release_redis_lock(key, expected_value)
    # Script Lua para garantir que só quem criou o lock é quem o apaga
    lua_script = <<-LUA
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    LUA
    $redis.eval(lua_script, [key], [expected_value])
  rescue StandardError => e
    Rails.logger.warn("[Redis Lock] Falha ao liberar lock: #{e.message}")
  end
end

