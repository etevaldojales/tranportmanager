class Ride < ApplicationRecord
  STATUSES = %w[PENDING IN_PROGRESS COMPLETED CANCELLED].freeze

  validates :user_id, presence: { message: 'Identificador do usuário (userId) é obrigatório' }
  validates :origin_address, presence: { message: 'Endereço de partida é obrigatório' }
  validates :destination_address, presence: { message: 'Endereço de destino é obrigatório' }
  validates :status, inclusion: { in: STATUSES }

  validate :validate_different_addresses

  scope :pending, -> { where(status: 'PENDING') }
  scope :in_progress, -> { where(status: 'IN_PROGRESS') }

  def pending?
    status == 'PENDING'
  end

  def in_progress?
    status == 'IN_PROGRESS'
  end

  private

  def validate_different_addresses
    return if origin_address.blank? || destination_address.blank?

    if origin_address.strip.downcase == destination_address.strip.downcase
      errors.add(:destination_address, 'O endereço de destino não pode ser igual ao ponto de partida')
    end
  end
end

