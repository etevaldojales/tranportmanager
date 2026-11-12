export interface Ride {
  id?: number;
  user_id: string;
  driver_id?: string | null;
  driver?: User;
  origin_address: string;
  destination_address: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'CLIENT' | 'DRIVER';
  email: string;
  vehicle?: string;
}

