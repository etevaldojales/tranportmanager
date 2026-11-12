require 'faraday'
require 'json'

class AccountServiceClient
  DEFAULT_URL = ENV.fetch('ACCOUNT_SERVICE_URL', 'http://account-service:3001')
  CACHE_TTL = 3600 # 1 hora no Redis para tolerância a falhas e performance

  attr_reader :service_unavailable

  def initialize(base_url = DEFAULT_URL)
    @service_unavailable = false
    @conn = Faraday.new(url: base_url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
      f.options.timeout = 3 # 3 segundos de timeout para evitar travamento em cascata
      f.options.open_timeout = 2
    end
  end

  def service_unavailable?
    @service_unavailable
  end

  def find_user(user_id)
    cache_key = "cache:account:user:#{user_id}"

    # 1. Cache-First: se já estiver no Redis, responde imediatamente sem sobrecarregar a rede
    if defined?($redis) && $redis
      cached = $redis.get(cache_key) rescue nil
      if cached.present?
        parsed = JSON.parse(cached) rescue nil
        return parsed if parsed.is_a?(Hash)
      end
    end

    # 2. Chama o microsserviço Account Service via HTTP
    response = @conn.get("/api/accounts/users/#{user_id}")

    if response.status == 200
      user_data = response.body
      # Salva no cache Redis para resiliência caso o serviço caia futuramente
      if defined?($redis) && $redis && user_data.is_a?(Hash)
        $redis.set(cache_key, user_data.to_json, ex: CACHE_TTL) rescue nil
      end
      return user_data
    end

    nil
  rescue Faraday::Error => e
    @service_unavailable = true
    Rails.logger.error("[AccountServiceClient] Falha na comunicação com Account Service (#{e.class}): #{e.message}")

    # 3. Fallback de Resiliência: se o Account Service estiver FORA DO AR mas o dado existe no cache
    if defined?($redis) && $redis
      cached = $redis.get(cache_key) rescue nil
      if cached.present?
        Rails.logger.warn("[AccountServiceClient] Fallback ativado: usando cache do Redis para o usuário '#{user_id}' devido à indisponibilidade do Account Service.")
        parsed = JSON.parse(cached) rescue nil
        return parsed if parsed.is_a?(Hash)
      end
    end

    nil
  end

  def user_exists?(user_id)
    !find_user(user_id).nil?
  end
end


