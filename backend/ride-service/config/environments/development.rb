require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = true
  config.eager_load = false
  config.consider_all_requests_local = true
  config.server_timing = true

  config.action_cable.disable_request_forgery_protection = true
  config.action_cable.url = "/cable"
  config.action_cable.allowed_request_origins = [%r{http://.*}, %r{https://.*}, nil]
end

