Rails.application.routes.draw do
  mount ActionCable.server => '/cable'

  get '/health', to: proc { [200, { 'Content-Type' => 'application/json' }, ['{"status":"UP","service":"ride-service"}']] }

  namespace :api do
    resources :rides, only: [:index, :show, :create] do
      member do
        post :accept
        post :cancel
        post :complete
      end
    end
  end
end

