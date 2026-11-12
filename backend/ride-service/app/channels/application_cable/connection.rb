module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user_id

    def connect
      self.current_user_id = request.params[:userId] || 'anonymous'
    end
  end
end

