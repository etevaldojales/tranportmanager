require 'faraday'
require 'json'

class AccountServiceClient
  DEFAULT_URL = ENV.fetch('ACCOUNT_SERVICE_URL', 'http://account-service:3001')

  def initialize(base_url = DEFAULT_URL)
    @conn = Faraday.new(url: base_url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
      f.options.timeout = 3 # 3 segundos de timeout
      f.options.open_timeout = 2
    end
  end

  def find_user(user_id)
    response = @conn.get("/api/accounts/users/#{user_id}")
    return response.body if response.status == 200

    nil
  rescue Faraday::Error => e
    Rails.logger.error("[AccountServiceClient] Falha na comunicação com Account Service: #{e.message}")
    nil
  end

  def user_exists?(user_id)
    !find_user(user_id).nil?
  end
end

