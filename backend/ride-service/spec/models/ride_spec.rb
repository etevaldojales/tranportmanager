require 'rails_helper'

RSpec.describe Ride, type: :model do
  describe 'Validações' do
    it 'é válido com atributos corretos' do
      ride = Ride.new(
        user_id: 'user-client-1',
        origin_address: 'Av. Santos Dumont, 1000 - Fortaleza',
        destination_address: 'Av. Beira Mar, 2000 - Fortaleza',
        status: 'PENDING'
      )
      expect(ride).to be_valid
    end

    it 'é inválido sem user_id' do
      ride = Ride.new(origin_address: 'A', destination_address: 'B')
      expect(ride).not_to be_valid
      expect(ride.errors[:user_id]).to be_present
    end

    it 'é inválido sem origin_address' do
      ride = Ride.new(user_id: 'user-1', destination_address: 'B')
      expect(ride).not_to be_valid
      expect(ride.errors[:origin_address]).to be_present
    end

    it 'é inválido sem destination_address' do
      ride = Ride.new(user_id: 'user-1', origin_address: 'A')
      expect(ride).not_to be_valid
      expect(ride.errors[:destination_address]).to be_present
    end

    it 'é inválido quando o endereço de partida e destino são iguais' do
      ride = Ride.new(
        user_id: 'user-client-1',
        origin_address: 'Rua Barão de Studart, 500',
        destination_address: 'Rua Barão de Studart, 500'
      )
      expect(ride).not_to be_valid
      expect(ride.errors[:destination_address]).to include('O endereço de destino não pode ser igual ao ponto de partida')
    end

    it 'ignora diferenças de maiúsculas e espaços na comparação de endereços iguais' do
      ride = Ride.new(
        user_id: 'user-client-1',
        origin_address: '  Praça do Ferreira  ',
        destination_address: 'PRAÇA DO FERREIRA'
      )
      expect(ride).not_to be_valid
      expect(ride.errors[:destination_address]).to include('O endereço de destino não pode ser igual ao ponto de partida')
    end
  end
end

