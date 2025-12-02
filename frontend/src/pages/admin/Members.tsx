import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import MemberFilters from '../../components/admin/members/MemberFilters';
import MemberTable from '../../components/admin/members/MemberTable';
import MemberGrid from '../../components/admin/members/MemberGrid';
import EditMemberModal from '../../components/admin/members/EditMemberModal';
import DeleteMemberModal from '../../components/admin/members/DeleteMemberModal';
import MemberDetailsModal from '../../components/admin/members/MemberDetailsModal';
import type { Member, Admin, Filters } from '../../types/member.types';

export default function Members() {
  const navigate = useNavigate();
  
  // State
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    ministry: '',
    membershipStatus: '',
    yearGroup: ''
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  
  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadAdminData();
    fetchMembers();
  }, []);

  // Debounced filter effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  // Load admin data from localStorage
  const loadAdminData = () => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      setAdmin(JSON.parse(adminData));
    }
  };

  // Fetch members with filters
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.ministry) params.append('ministry', filters.ministry);
      if (filters.membershipStatus) params.append('membershipStatus', filters.membershipStatus);
      if (filters.yearGroup) params.append('yearGroup', filters.yearGroup);

      const response = await api.get(`/api/members?${params. toString()}`);
      
      if (response.data.success) {
        setMembers(response.data.data. members || []);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Filter handlers
  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      ministry: '',
      membershipStatus: '',
      yearGroup: ''
    });
  };

  // View member details
  const viewMemberDetails = (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowDetailsModal(true);
  };

  // Edit member
  const handleEdit = (member: Member) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const saveEdit = async (formData: Partial<Member>) => {
    if (! selectedMember) return;

    try {
      setIsSaving(true);

      // Clean the data
      const cleanData: any = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== undefined) {
          cleanData[key] = value;
        }
      });

      const response = await api.put(`/api/members/${selectedMember. id}`, cleanData);

      if (response.data.success) {
        setShowEditModal(false);
        setSelectedMember(null);
        fetchMembers();
      }
    } catch (error: any) {
      console.error('Error updating member:', error);
      alert(error.response?.data?.message || 'Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete member
  const handleDelete = (member: Member) => {
    setSelectedMember(member);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (! selectedMember) return;

    try {
      await api.delete(`/api/members/${selectedMember.id}`);
      setShowDeleteModal(false);
      setSelectedMember(null);
      fetchMembers();
    } catch (error: any) {
      console.error('Error deleting member:', error);
      alert(error.response?.data?.message || 'Failed to delete member');
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Dashboard
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center px-4 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                  <span className="text-teal-600 font-semibold text-sm">
                    {admin?.firstName. charAt(0)}{admin?.lastName.charAt(0)}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">
                    {admin?.firstName} {admin?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{admin?.role}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Members Management</h1>
          <p className="text-gray-600">View, search, and manage all church members</p>
        </div>

        {/* Filters */}
        <MemberFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={clearFilters}
          memberCount={members.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Loading State */}
        {loading ?  (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <p className="mt-4 text-gray-600">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4. 354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No members found</h3>
            <p className="text-gray-600 mb-4">
              {filters.search || filters.ministry || filters.membershipStatus || filters.yearGroup
                ? 'Try adjusting your filters'
                : 'No members have been registered yet'}
            </p>
            {(filters.search || filters.ministry || filters.membershipStatus || filters. yearGroup) && (
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <MemberTable
            members={members}
            onView={viewMemberDetails}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isElder={admin?.role === 'ELDER'}
          />
        ) : (
          /* Grid View */
          <MemberGrid
            members={members}
            onView={viewMemberDetails}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isElder={admin?.role === 'ELDER'}
          />
        )}
      </div>

      {/* Modals */}
      {selectedMemberId && (
        <MemberDetailsModal
          memberId={selectedMemberId}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMemberId(null);
          }}
        />
      )}

      <EditMemberModal
        member={selectedMember}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMember(null);
        }}
        onSave={saveEdit}
        isElder={admin?.role === 'ELDER'}
        isSaving={isSaving}
      />

      <DeleteMemberModal
        member={selectedMember}
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedMember(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}