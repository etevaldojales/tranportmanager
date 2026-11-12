module Api
  module Accounts
    class UsersController < ApplicationController
      # Base mockada de clientes e motoristas conforme previsto no edital
      MOCKED_USERS = {
        'user-client-1' => { id: 'user-client-1', name: 'Carlos Silva (Cliente)', role: 'CLIENT', email: 'carlos@exemplo.com' },
        'user-client-2' => { id: 'user-client-2', name: 'Mariana Souza (Cliente)', role: 'CLIENT', email: 'mariana@exemplo.com' },
        'user-driver-1' => { id: 'user-driver-1', name: 'João Pedro (Motorista)', role: 'DRIVER', email: 'joao@exemplo.com', vehicle: 'Toyota Corolla - ABC-1234' },
        'user-driver-2' => { id: 'user-driver-2', name: 'Ana Oliveira (Motorista)', role: 'DRIVER', email: 'ana@exemplo.com', vehicle: 'Honda Civic - XYZ-9876' }
      }.freeze

      def index
        role = params[:role]&.upcase
        users = if role.present?
                  MOCKED_USERS.values.select { |u| u[:role] == role }
                else
                  MOCKED_USERS.values
                end
        render json: users, status: :ok
      end

      def show
        user = MOCKED_USERS[params[:id]]

        if user
          render json: user, status: :ok
        else
          render json: { error: 'Usuário não encontrado', userId: params[:id] }, status: :not_found
        end
      end
    end
  end
end

