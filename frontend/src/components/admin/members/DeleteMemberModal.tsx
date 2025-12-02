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

interface DeleteMemberModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteMemberModal({ member, isOpen, onClose, onConfirm }: DeleteMemberModalProps) {
  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333. 192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Member</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>{member.firstName} {member.lastName}</strong>?  
            This action cannot be undone.
          </p>
          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}