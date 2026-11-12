Rails.application.routes.draw do
  get '/health', to: proc { [200, { 'Content-Type' => 'application/json' }, ['{"status":"UP","service":"account-service"}']] }
  
  namespace :api do
    namespace :accounts do
      resources :users, only: [:index, :show]
    end
  end
end

