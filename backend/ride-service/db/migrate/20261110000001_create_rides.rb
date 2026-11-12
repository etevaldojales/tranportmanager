class CreateRides < ActiveRecord::Migration[7.1]
  def change
    create_table :rides do |t|
      t.string :user_id, null: false
      t.string :driver_id
      t.string :origin_address, null: false
      t.string :destination_address, null: false
      t.string :status, default: 'PENDING', null: false

      t.timestamps
    end

    add_index :rides, :status
    add_index :rides, :user_id
    add_index :rides, :driver_id
  end
end

