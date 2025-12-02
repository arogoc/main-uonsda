export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  dateBaptised?: string;
  gender?: 'MALE' | 'FEMALE';
  address?: string;
  city?: string;
  membershipStatus: 'ACTIVE' | 'INACTIVE' | 'VISITOR';
  dateJoined: string;
  isLeader: boolean;
  ministry?: 'FOJ' | 'ARK' | 'VINEYARD' | 'PILGRIMS';
  course?: string;
  faculty?: string;
  yearGroup?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
}

export interface Filters {
  search: string;
  ministry: string;
  membershipStatus: string;
  yearGroup: string;
}