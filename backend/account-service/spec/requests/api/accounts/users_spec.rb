require 'rails_helper'

RSpec.describe 'Api::Accounts::Users', type: :request do
  describe 'GET /api/accounts/users/:id' do
    context 'quando o usuário existe' do
      it 'retorna status 200 com os dados do cliente' do
        get '/api/accounts/users/user-client-1'

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['id']).to eq('user-client-1')
        expect(json['role']).to eq('CLIENT')
        expect(json['name']).to include('Carlos Silva')
      end

      it 'retorna status 200 com os dados do motorista' do
        get '/api/accounts/users/user-driver-1'

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['id']).to eq('user-driver-1')
        expect(json['role']).to eq('DRIVER')
        expect(json['vehicle']).to be_present
      end
    end

    context 'quando o usuário não existe' do
      it 'retorna status 404 e mensagem de erro' do
        get '/api/accounts/users/inexistente'

        expect(response).to have_http_status(:not_found)
        json = JSON.parse(response.body)
        expect(json['error']).to eq('Usuário não encontrado')
      end
    end
  end

  describe 'GET /api/accounts/users' do
    it 'retorna a lista de usuários mockados' do
      get '/api/accounts/users'

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.size).to be >= 4
    end

    it 'filtra por role' do
      get '/api/accounts/users', params: { role: 'DRIVER' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.all? { |u| u['role'] == 'DRIVER' }).to be true
    end
  end
end

