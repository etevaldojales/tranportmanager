require 'rails_helper'

RSpec.describe 'Api::Rides', type: :request do
  let(:account_service_url) { 'http://account-service:3001' }

  describe 'GET /api/rides' do
    let!(:ride1) { Ride.create!(user_id: 'user-client-1', driver_id: 'user-driver-1', origin_address: 'A', destination_address: 'B', status: 'COMPLETED', created_at: Time.zone.now) }
    let!(:ride2) { Ride.create!(user_id: 'user-client-2', driver_id: 'user-driver-1', origin_address: 'C', destination_address: 'D', status: 'CANCELLED', created_at: Time.zone.now) }
    let!(:ride3) { Ride.create!(user_id: 'user-client-1', driver_id: 'user-driver-2', origin_address: 'E', destination_address: 'F', status: 'PENDING', created_at: 3.days.ago) }

    before do
      stub_request(:get, "#{account_service_url}/api/accounts/users/user-driver-1")
        .to_return(status: 200, body: { id: 'user-driver-1', name: 'João Pedro' }.to_json, headers: { 'Content-Type' => 'application/json' })
      stub_request(:get, "#{account_service_url}/api/accounts/users/user-driver-2")
        .to_return(status: 200, body: { id: 'user-driver-2', name: 'Ana Oliveira' }.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'filtra corridas por motorista e por período de datas' do
      today_str = Time.zone.today.to_s
      get '/api/rides', params: { driver_id: 'user-driver-1', start_date: today_str, end_date: today_str }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json.size).to eq(2)
      statuses = json.map { |r| r['status'] }
      expect(statuses).to include('COMPLETED', 'CANCELLED')
      expect(json.first['driver']['name']).to eq('João Pedro')
    end
  end

  describe 'POST /api/rides' do
    let(:valid_params) do
      {
        ride: {
          user_id: 'user-client-1',
          origin_address: 'Av. Washington Soares, 100',
          destination_address: 'Av. Dom Luís, 500'
        }
      }
    end

    context 'quando o usuário existe no Account Service e os parâmetros são válidos' do
      before do
        stub_request(:get, "#{account_service_url}/api/accounts/users/user-client-1")
          .to_return(status: 200, body: { id: 'user-client-1', name: 'Carlos', role: 'CLIENT' }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it 'cria a corrida com status PENDING e retorna 201' do
        expect {
          post '/api/rides', params: valid_params
        }.to change(Ride, :count).by(1)

        expect(response).to have_http_status(:created)
        json = JSON.parse(response.body)
        expect(json['status']).to eq('PENDING')
        expect(json['user_id']).to eq('user-client-1')
        expect(json['origin_address']).to eq('Av. Washington Soares, 100')
      end
    end

    context 'quando o usuário NÃO existe no Account Service (comunicação East-West)' do
      before do
        stub_request(:get, "#{account_service_url}/api/accounts/users/user-invalido")
          .to_return(status: 404, body: { error: 'Usuário não encontrado' }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it 'recusa a criação da corrida e retorna 400 Bad Request' do
        post '/api/rides', params: {
          ride: {
            user_id: 'user-invalido',
            origin_address: 'Rua A',
            destination_address: 'Rua B'
          }
        }

        expect(response).to have_http_status(:bad_request)
        json = JSON.parse(response.body)
        expect(json['error']).to include('não foi encontrado no Account Service')
      end
    end

    context 'quando os endereços de partida e destino são iguais' do
      before do
        stub_request(:get, "#{account_service_url}/api/accounts/users/user-client-1")
          .to_return(status: 200, body: { id: 'user-client-1' }.to_json, headers: { 'Content-Type' => 'application/json' })
      end

      it 'retorna erro 422 Unprocessable Entity' do
        post '/api/rides', params: {
          ride: {
            user_id: 'user-client-1',
            origin_address: 'Mesmo Endereço',
            destination_address: 'Mesmo Endereço'
          }
        }

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        expect(json['errors']).to be_present
      end
    end
  end

  describe 'POST /api/rides/:id/accept' do
    let!(:ride) do
      Ride.create!(
        user_id: 'user-client-1',
        origin_address: 'Origem X',
        destination_address: 'Destino Y',
        status: 'PENDING'
      )
    end

    before do
      stub_request(:get, "#{account_service_url}/api/accounts/users/user-driver-1")
        .to_return(status: 200, body: { id: 'user-driver-1', name: 'João Pedro', role: 'DRIVER' }.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'permite que o primeiro motorista aceite a corrida' do
      post "/api/rides/#{ride.id}/accept", params: { driver_id: 'user-driver-1' }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['message']).to eq('Corrida aceita com sucesso!')
      expect(ride.reload.status).to eq('IN_PROGRESS')
      expect(ride.driver_id).to eq('user-driver-1')
    end

    it 'rejeita tentativa de aceitar corrida já aceita com 409 Conflict' do
      # Primeiro aceite
      post "/api/rides/#{ride.id}/accept", params: { driver_id: 'user-driver-1' }
      expect(response).to have_http_status(:ok)

      # Segundo aceite concorrente
      stub_request(:get, "#{account_service_url}/api/accounts/users/user-driver-2")
        .to_return(status: 200, body: { id: 'user-driver-2', name: 'Ana Oliveira', role: 'DRIVER' }.to_json, headers: { 'Content-Type' => 'application/json' })

      post "/api/rides/#{ride.id}/accept", params: { driver_id: 'user-driver-2' }
      expect(response).to have_http_status(:conflict)
      json = JSON.parse(response.body)
      expect(json['error']).to include('já foi aceita')
    end
  end

  describe 'POST /api/rides/:id/cancel' do
    let!(:ride) do
      Ride.create!(
        user_id: 'user-client-1',
        origin_address: 'Origem A',
        destination_address: 'Destino B',
        status: 'IN_PROGRESS',
        driver_id: 'user-driver-1'
      )
    end

    it 'permite que o motorista cancele a corrida e notifica via canais' do
      expect(ClientRideChannel).to receive(:broadcast_status_change).with(ride, nil, hash_including(cancelled_by: 'DRIVER'))
      expect(ClientRideChannel).to receive(:broadcast_cancellation).with(ride, 'DRIVER', nil)
      expect(DriverRidesChannel).to receive(:broadcast_ride_cancelled).with(ride, 'DRIVER', nil)
      expect(DriverRidesChannel).to receive(:broadcast_ride_taken).with(ride.id, nil)

      post "/api/rides/#{ride.id}/cancel", params: { cancelled_by: 'DRIVER' }

      expect(response).to have_http_status(:ok)
      expect(ride.reload.status).to eq('CANCELLED')
      json = JSON.parse(response.body)
      expect(json['cancelled_by']).to eq('DRIVER')
    end

    it 'permite que o cliente desista/cancele a corrida e notifica via canais' do
      expect(ClientRideChannel).to receive(:broadcast_status_change).with(ride, nil, hash_including(cancelled_by: 'CLIENT'))
      expect(ClientRideChannel).to receive(:broadcast_cancellation).with(ride, 'CLIENT', nil)
      expect(DriverRidesChannel).to receive(:broadcast_ride_cancelled).with(ride, 'CLIENT', nil)
      expect(DriverRidesChannel).to receive(:broadcast_ride_taken).with(ride.id, nil)

      post "/api/rides/#{ride.id}/cancel", params: { cancelled_by: 'CLIENT' }

      expect(response).to have_http_status(:ok)
      expect(ride.reload.status).to eq('CANCELLED')
      json = JSON.parse(response.body)
      expect(json['cancelled_by']).to eq('CLIENT')
    end

    it 'rejeita cancelamento de corrida já concluída (COMPLETED)' do
      ride.update!(status: 'COMPLETED')

      post "/api/rides/#{ride.id}/cancel", params: { cancelled_by: 'CLIENT' }

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to include('Não é possível cancelar uma corrida já concluída')
    end
  end

  describe 'POST /api/rides/:id/complete' do
    let!(:ride) do
      Ride.create!(
        user_id: 'user-client-1',
        origin_address: 'Origem A',
        destination_address: 'Destino B',
        status: 'IN_PROGRESS',
        driver_id: 'user-driver-1'
      )
    end

    before do
      stub_request(:get, "#{account_service_url}/api/accounts/users/user-driver-1")
        .to_return(status: 200, body: { id: 'user-driver-1', name: 'João Pedro', role: 'DRIVER', vehicle: 'Toyota Corolla' }.to_json, headers: { 'Content-Type' => 'application/json' })
    end

    it 'permite concluir a corrida em andamento e notifica cliente e motoristas' do
      expect(ClientRideChannel).to receive(:broadcast_status_change).with(ride, hash_including('name' => 'João Pedro'))
      expect(ClientRideChannel).to receive(:broadcast_completion).with(ride, hash_including('name' => 'João Pedro'))
      expect(DriverRidesChannel).to receive(:broadcast_ride_completed).with(ride, hash_including('name' => 'João Pedro'))

      post "/api/rides/#{ride.id}/complete", params: { driver_id: 'user-driver-1' }

      expect(response).to have_http_status(:ok)
      expect(ride.reload.status).to eq('COMPLETED')
      json = JSON.parse(response.body)
      expect(json['message']).to eq('Corrida concluída com sucesso!')
      expect(json['ride']['driver']['name']).to eq('João Pedro')
    end

    it 'rejeita conclusão se a corrida não estiver em andamento (IN_PROGRESS)' do
      ride.update!(status: 'PENDING')

      post "/api/rides/#{ride.id}/complete", params: { driver_id: 'user-driver-1' }

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to include('Apenas corridas em andamento podem ser concluídas')
    end
  end
end

