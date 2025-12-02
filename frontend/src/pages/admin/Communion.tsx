import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
}

interface CommunionService {
  id: string;
  serviceDate: string;
  quarter: number;
  year: number;
  location: string | null;
  notes: string | null;
  totalParticipants: number;
  membersCount: number;
  visitorsCount: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  communionRecords?: CommunionRecord[];
}

interface CommunionRecord {
  id: string;
  participantType: 'MEMBER' | 'VISITOR';
  member?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    ministry: string | null;
  };
  visitorName?: string;
  visitorChurch?: string;
  visitorPhone?: string;
  visitorEmail?: string;
  recordedAt: string;
}

interface CommunionStats {
  year: number;
  quarterlyStats: Array<{
    quarter: number;
    _sum: {
      totalParticipants: number;
      membersCount: number;
      visitorsCount: number;
    };
    _count: number;
  }>;
  yearTotal: {
    _sum: {
      totalParticipants: number;
      membersCount: number;
      visitorsCount: number;
    };
    _count: number;
  };
  totalActiveMembers: number;
  uniqueMembersParticipated: number;
  participationRate: string;
}

export default function Communion() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [services, setServices] = useState<CommunionService[]>([]);
  const [stats, setStats] = useState<CommunionStats | null>(null);
  const [selectedService, setSelectedService] = useState<CommunionService | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'overview' | 'service'>('overview');
  
  const [showNewServiceModal, setShowNewServiceModal] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({
    serviceDate: '',
    location: '',
    notes: ''
  });

  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [participantForm, setParticipantForm] = useState({
    participantType: 'MEMBER' as 'MEMBER' | 'VISITOR',
    memberEmail: '',
    visitorName: '',
    visitorChurch: '',
    visitorPhone: '',
    visitorEmail: ''
  });

  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterQuarter, setFilterQuarter] = useState('');

  useEffect(() => {
    loadAdminData();
    fetchServices();
    fetchStats();
  }, [filterYear, filterQuarter]);

  const loadAdminData = () => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      setAdmin(JSON.parse(adminData));
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('year', filterYear.toString());
      if (filterQuarter) params.append('quarter', filterQuarter);

      const response = await api.get(`/api/communion/services?${params.toString()}`);
      if (response.data.success) {
        setServices(response.data.data);
      }
    } catch (error: any) {
      console.error('Error fetching communion services:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get(`/api/communion/stats?year=${filterYear}`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching communion stats:', error);
    }
  };

  const fetchServiceDetails = async (serviceId: string) => {
    try {
      const response = await api.get(`/api/communion/services/${serviceId}`);
      if (response.data.success) {
        setSelectedService(response.data.data);
        setViewMode('service');
      }
    } catch (error) {
      console.error('Error fetching service details:', error);
    }
  };

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/communion/services', newServiceForm);
      if (response.data.success) {
        setShowNewServiceModal(false);
        setNewServiceForm({ serviceDate: '', location: '', notes: '' });
        fetchServices();
        fetchStats();
        alert('Communion service created successfully!');
      }
    } catch (error: any) {
      console.error('Error creating service:', error);
      alert(error.response?.data?.message || 'Failed to create service');
    }
  };

  const addParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      const response = await api.post(`/api/communion/services/${selectedService.id}/participants`, participantForm);
      if (response.data.success) {
        setShowAddParticipantModal(false);
        setParticipantForm({
          participantType: 'MEMBER',
          memberEmail: '',
          visitorName: '',
          visitorChurch: '',
          visitorPhone: '',
          visitorEmail: ''
        });
        fetchServiceDetails(selectedService.id);
        fetchStats();
        alert('Participant added successfully!');
      }
    } catch (error: any) {
      console.error('Error adding participant:', error);
      alert(error.response?.data?.message || 'Failed to add participant');
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      const response = await api.delete(`/api/communion/participants/${participantId}`);
      if (response.data.success) {
        if (selectedService) {
          fetchServiceDetails(selectedService.id);
        }
        fetchStats();
      }
    } catch (error: any) {
      console.error('Error removing participant:', error);
      alert(error.response?.data?.message || 'Failed to remove participant');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this communion service? This will remove all participant records.')) return;

    try {
      const response = await api.delete(`/api/communion/services/${serviceId}`);
      if (response.data.success) {
        fetchServices();
        fetchStats();
        if (selectedService?.id === serviceId) {
          setViewMode('overview');
          setSelectedService(null);
        }
      }
    } catch (error: any) {
      console.error('Error deleting service:', error);
      alert(error.response?.data?.message || 'Failed to delete service');
    }
  };

  const openService = async (serviceId: string) => {
    try {
      const response = await api.put(`/api/communion/services/${serviceId}/open`);
      if (response.data.success) {
        fetchServices();
        alert('Communion service is now open for participation!');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to open service');
    }
  };

  const closeService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to close this communion service? Members will no longer be able to register.')) return;
    
    try {
      const response = await api.put(`/api/communion/services/${serviceId}/close`);
      if (response.data.success) {
        fetchServices();
        alert('Communion service has been closed.');
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to close service');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getQuarterName = (quarter: number) => {
    return `Q${quarter} (${['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'][quarter - 1]})`;
  };

  const exportToCSV = () => {
    if (!selectedService) return;

    const headers = ['Type', 'Name', 'Email', 'Church/Ministry', 'Phone', 'Date'];
    const rows = selectedService.communionRecords?.map(record => {
      if (record.participantType === 'MEMBER' && record.member) {
        return [
          'Member',
          `${record.member.firstName} ${record.member.lastName}`,
          record.member.email,
          record.member.ministry || 'N/A',
          '-',
          formatDate(record.recordedAt)
        ];
      } else {
        return [
          'Visitor',
          record.visitorName || '-',
          record.visitorEmail || '-',
          record.visitorChurch || '-',
          record.visitorPhone || '-',
          formatDate(record.recordedAt)
        ];
      }
    }) || [];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communion_${selectedService.serviceDate.split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => {
                  if (viewMode === 'service') {
                    setViewMode('overview');
                    setSelectedService(null);
                  } else {
                    navigate('/admin');
                  }
                }}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {viewMode === 'service' ? 'Back to Overview' : 'Back to Dashboard'}
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center px-4 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                  <span className="text-teal-600 font-semibold text-sm">
                    {admin?.firstName.charAt(0)}{admin?.lastName.charAt(0)}
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
        {viewMode === 'overview' ? (
          <>
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Holy Communion Management</h1>
              <p className="text-gray-600">Track communion services and participants</p>
            </div>

            {/* Statistics Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Services ({filterYear})</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats.yearTotal._count || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Participants</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats.yearTotal._sum.totalParticipants || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">UONSDA Members</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats.yearTotal._sum.membersCount || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Visitors</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats.yearTotal._sum.visitorsCount || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quarterly Breakdown */}
            {stats && stats.quarterlyStats.length > 0 && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quarterly Breakdown ({filterYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(quarter => {
                    const quarterData = stats.quarterlyStats.find(q => q.quarter === quarter);
                    return (
                      <div key={quarter} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold text-gray-900 mb-2">{getQuarterName(quarter)}</h4>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-600">
                            Services: <span className="font-medium text-gray-900">{quarterData?._count || 0}</span>
                          </p>
                          <p className="text-gray-600">
                            Total: <span className="font-medium text-gray-900">{quarterData?._sum.totalParticipants || 0}</span>
                          </p>
                          <p className="text-gray-600">
                            Members: <span className="font-medium text-green-700">{quarterData?._sum.membersCount || 0}</span>
                          </p>
                          <p className="text-gray-600">
                            Visitors: <span className="font-medium text-orange-700">{quarterData?._sum.visitorsCount || 0}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Participation Rate */}
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-900">Member Participation Rate</p>
                      <p className="text-xs text-purple-700 mt-1">
                        {stats.uniqueMembersParticipated} out of {stats.totalActiveMembers} active members participated
                      </p>
                    </div>
                    <div className="text-3xl font-bold text-purple-700">{stats.participationRate}%</div>
                  </div>
                  <div className="mt-3 w-full bg-purple-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${stats.participationRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters and Actions */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(parseInt(e.target.value))}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    >
                      {[...Array(5)].map((_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={year} value={year}>{year}</option>;
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
                    <select
                      value={filterQuarter}
                      onChange={(e) => setFilterQuarter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    >
                      <option value="">All Quarters</option>
                      <option value="1">Q1 (Jan-Mar)</option>
                      <option value="2">Q2 (Apr-Jun)</option>
                      <option value="3">Q3 (Jul-Sep)</option>
                      <option value="4">Q4 (Oct-Dec)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setShowNewServiceModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Communion Service
                </button>
              </div>
            </div>

            {/* Services List */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Communion Services</h3>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <p className="mt-4 text-gray-600">Loading services...</p>
                </div>
              ) : services.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No communion services found</h3>
                  <p className="text-gray-600 mb-4">Create your first communion service to get started</p>
                  <button
                    onClick={() => setShowNewServiceModal(true)}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Create Service
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {services.map((service) => (
                    <div key={service.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{formatDate(service.serviceDate)}</h4>
                            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                              Q{service.quarter} {service.year}
                            </span>
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              service.status === 'OPEN' 
                                ? 'bg-green-100 text-green-800 animate-pulse' 
                                : service.status === 'CLOSED'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {service.status === 'OPEN' && '🟢 OPEN'}
                              {service.status === 'CLOSED' && '⚫ CLOSED'}
                              {service.status === 'DRAFT' && '📝 DRAFT'}
                            </span>
                          </div>
                          {service.location && (
                            <p className="text-sm text-gray-600 mb-1">📍 {service.location}</p>
                          )}
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-gray-600">
                              Total: <span className="font-medium text-gray-900">{service.totalParticipants}</span>
                            </span>
                            <span className="text-gray-600">
                              Members: <span className="font-medium text-green-700">{service.membersCount}</span>
                            </span>
                            <span className="text-gray-600">
                              Visitors: <span className="font-medium text-orange-700">{service.visitorsCount}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {service.status !== 'OPEN' && (
                            <button
                              onClick={() => openService(service.id)}
                              className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
                            >
                              Open
                            </button>
                          )}
                          
                          {service.status === 'OPEN' && (
                            <button
                              onClick={() => closeService(service.id)}
                              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
                            >
                              Close
                            </button>
                          )}

                          <button
                            onClick={() => fetchServiceDetails(service.id)}
                            className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                          >
                            View Details
                          </button>
                          
                          {admin?.role === 'ELDER' && (
                            <button
                              onClick={() => deleteService(service.id)}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Service Details View */
          selectedService && (
            <>
              {/* Service Header */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{formatDate(selectedService.serviceDate)}</h2>
                    <p className="text-gray-600">Q{selectedService.quarter} {selectedService.year}</p>
                  </div>
                  <span className="px-4 py-2 bg-purple-100 text-purple-800 font-medium rounded-lg">
                    {selectedService.totalParticipants} Participants
                  </span>
                </div>

                {selectedService.location && (
                  <p className="text-gray-700 mb-2">📍 Location: {selectedService.location}</p>
                )}
                {selectedService.notes && (
                  <p className="text-gray-600 text-sm bg-gray-50 p-3 rounded-lg">📝 {selectedService.notes}</p>
                )}

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-700">{selectedService.totalParticipants}</p>
                    <p className="text-sm text-gray-600">Total</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{selectedService.membersCount}</p>
                    <p className="text-sm text-gray-600">Members</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-700">{selectedService.visitorsCount}</p>
                    <p className="text-sm text-gray-600">Visitors</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setShowAddParticipantModal(true)}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Participant
                </button>

                <button
                  onClick={exportToCSV}
                  disabled={!selectedService.communionRecords || selectedService.communionRecords.length === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>

              {/* Participants List */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Participants</h3>
                </div>

                {!selectedService.communionRecords || selectedService.communionRecords.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-gray-600">No participants recorded yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Church/Ministry</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedService.communionRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                record.participantType === 'MEMBER' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {record.participantType}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {record.participantType === 'MEMBER' && record.member ? (
                                  <>
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                      <span className="text-green-700 font-semibold text-sm">
                                        {record.member.firstName.charAt(0)}{record.member.lastName.charAt(0)}
                                      </span>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">
                                        {record.member.firstName} {record.member.lastName}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                      <span className="text-orange-700 font-semibold text-sm">
                                        {record.visitorName?.charAt(0) || 'V'}
                                      </span>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-medium text-gray-900">{record.visitorName}</div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.participantType === 'MEMBER' && record.member 
                                ? record.member.email 
                                : record.visitorEmail || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.participantType === 'MEMBER' && record.member 
                                ? record.member.ministry || 'N/A'
                                : record.visitorChurch || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.visitorPhone || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => removeParticipant(record.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>

      {/* New Service Modal */}
      {showNewServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">New Communion Service</h3>
              <button
                onClick={() => {
                  setShowNewServiceModal(false);
                  setNewServiceForm({ serviceDate: '', location: '', notes: '' });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createService} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newServiceForm.serviceDate}
                  onChange={(e) => setNewServiceForm(prev => ({ ...prev, serviceDate: e.target.value }))}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={newServiceForm.location}
                  onChange={(e) => setNewServiceForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Main Campus Church"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={newServiceForm.notes}
                  onChange={(e) => setNewServiceForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Any additional notes about this service"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewServiceModal(false);
                    setNewServiceForm({ serviceDate: '', location: '', notes: '' });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium"
                >
                  Create Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {showAddParticipantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add Participant</h3>
              <button
                onClick={() => {
                  setShowAddParticipantModal(false);
                  setParticipantForm({
                    participantType: 'MEMBER',
                    memberEmail: '',
                    visitorName: '',
                    visitorChurch: '',
                    visitorPhone: '',
                    visitorEmail: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={addParticipant} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participant Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setParticipantForm(prev => ({ ...prev, participantType: 'MEMBER' }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      participantForm.participantType === 'MEMBER'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                        participantForm.participantType === 'MEMBER' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          participantForm.participantType === 'MEMBER' ? 'text-green-600' : 'text-gray-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <p className="font-medium">UONSDA Member</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setParticipantForm(prev => ({ ...prev, participantType: 'VISITOR' }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      participantForm.participantType === 'VISITOR'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-center">
                      <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                        participantForm.participantType === 'VISITOR' ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          participantForm.participantType === 'VISITOR' ? 'text-orange-600' : 'text-gray-600'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <p className="font-medium">Visitor</p>
                    </div>
                  </button>
                </div>
              </div>

              {participantForm.participantType === 'MEMBER' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Member Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={participantForm.memberEmail}
                    onChange={(e) => setParticipantForm(prev => ({ ...prev, memberEmail: e.target.value }))}
                    required
                    placeholder="member@students.uonbi.ac.ke"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter the registered member's email address</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Visitor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={participantForm.visitorName}
                      onChange={(e) => setParticipantForm(prev => ({ ...prev, visitorName: e.target.value }))}
                      required
                      placeholder="John Doe"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Home Church</label>
                    <input
                      type="text"
                      value={participantForm.visitorChurch}
                      onChange={(e) => setParticipantForm(prev => ({ ...prev, visitorChurch: e.target.value }))}
                      placeholder="e.g., Central SDA Church"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                      <input
                        type="tel"
                        value={participantForm.visitorPhone}
                        onChange={(e) => setParticipantForm(prev => ({ ...prev, visitorPhone: e.target.value }))}
                        placeholder="+254 712 345 678"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={participantForm.visitorEmail}
                        onChange={(e) => setParticipantForm(prev => ({ ...prev, visitorEmail: e.target.value }))}
                        placeholder="visitor@email.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddParticipantModal(false);
                    setParticipantForm({
                      participantType: 'MEMBER',
                      memberEmail: '',
                      visitorName: '',
                      visitorChurch: '',
                      visitorPhone: '',
                      visitorEmail: ''
                    });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium"
                >
                  Add Participant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}