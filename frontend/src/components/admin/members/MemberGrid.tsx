import MemberCard from './MemberCard';

interface Member {
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

interface MemberGridProps {
  members: Member[];
  onView: (id: string) => void;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
  isElder: boolean;
}

export default function MemberGrid({ members, onView, onEdit, onDelete, isElder }: MemberGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          isElder={isElder}
        />
      ))}
    </div>
  );
}