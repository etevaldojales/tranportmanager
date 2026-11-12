class ApplicationController < ActionController::API
  rescue_from ActionController::ParameterMissing do |e|
    render json: { error: "Parâmetro obrigatório ausente: #{e.param}" }, status: :bad_request
  end

  rescue_from ActiveRecord::RecordNotFound do |e|
    render json: { error: "Recurso não encontrado: #{e.message}" }, status: :not_found
  end
end

