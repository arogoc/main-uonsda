import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import LocationManagement from '../../components/admin/LocationManagement';

interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface CurrentAdmin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
  phone?: string;
}

interface NewAdminForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'ELDER' | 'CLERK';
  phone: string;
}

interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

type ActiveTab = 'profile' | 'admins' | 'security' | 'locations';

export default function Settings() {
  const navigate = useNavigate();
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  
  // New Admin Modal
  const [showNewAdminModal, setShowNewAdminModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState<NewAdminForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'CLERK',
    phone: ''
  });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // Password Change
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadCurrentAdmin();
    loadAdmins();
  }, []);

  const loadCurrentAdmin = () => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      setCurrentAdmin(JSON.parse(adminData));
    }
  };

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const adminData = localStorage.getItem('admin');
      if (!adminData) return;

      const admin = JSON.parse(adminData);
      
      // Only ELDER can view all admins
      if (admin.role === 'ELDER') {
        const response = await api.get('/api/auth/admins');
        if (response.data.success) {
          setAdmins(response.data.data || []);
        }
      }
    } catch (error: any) {
      console.error('Error loading admins:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewAdminInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewAdminForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const createNewAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    // Validate password length
    if (newAdminForm.password.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    try {
      setIsCreatingAdmin(true);

      const response = await api.post('/api/auth/register', {
        firstName: newAdminForm.firstName,
        lastName: newAdminForm.lastName,
        email: newAdminForm.email,
        password: newAdminForm.password,
        role: newAdminForm.role,
        phone: newAdminForm.phone || undefined
      });

      if (response.data.success) {
        setShowNewAdminModal(false);
        setNewAdminForm({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          role: 'CLERK',
          phone: ''
        });
        loadAdmins(); // Reload admin list
        alert('Admin created successfully!');
      }
    } catch (error: any) {
      console.error('Error creating admin:', error);
      alert(error.response?.data?.message || 'Failed to create admin');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this admin?`)) {
      return;
    }

    try {
      const response = await api.put(`/api/auth/admins/${adminId}/status`, {
        isActive: !currentStatus
      });

      if (response.data.success) {
        loadAdmins(); // Reload admin list
      }
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      alert(error.response?.data?.message || 'Failed to update admin status');
    }
  };

  const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }

    // Validate password length
    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters long!' });
      return;
    }

    try {
      setIsChangingPassword(true);

      const response = await api.put('/api/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      if (response.data.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        });
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      setPasswordMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to change password' 
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center text-gray-600 hover:text-gray-900"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline ml-2">Back to Dashboard</span>
            </button>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center px-2 py-1 sm:px-4 sm:py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-600 font-semibold text-sm">
                    {currentAdmin?.firstName.charAt(0)}{currentAdmin?.lastName.charAt(0)}
                  </span>
                </div>
                <div className="ml-2 sm:ml-3">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    {currentAdmin?.firstName} {currentAdmin?.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{currentAdmin?.role}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 sm:px-4 sm:py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                title="Logout"
              >
                 <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

  

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage your account and system settings</p>
          </div>

          <div className="bg-white rounded-xl shadow-md">
            {/* Mobile Tabs (Dropdown) */}
            <div className="md:hidden border-b border-gray-200">
              <select
                id="tabs"
                name="tabs"
                className="block w-full rounded-t-xl py-3 pl-3 pr-10 border-none focus:ring-teal-500 focus:border-teal-500 text-base"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as ActiveTab)}
              >
                <option value="profile">My Profile</option>
                <option value="security">Security</option>
                <option value="locations">Church Locations</option>
                {currentAdmin?.role === 'ELDER' && <option value="admins">Admin Management</option>}
              </select>
            </div>

            {/* Desktop Tabs */}
            <div className="hidden md:block border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  My Profile
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'security' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Security
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'locations' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Church Locations
                </button>
                {currentAdmin?.role === 'ELDER' && (
                  <button
                    onClick={() => setActiveTab('admins')}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'admins' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    Admin Management
                  </button>
                )}
              </nav>
            </div>

  

            {/* Tab Content */}

            <div className="p-4 sm:p-6">

              {activeTab === 'profile' && (

                <div className="max-w-4xl">

                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Profile Information</h2>

                  <div className="space-y-6">

                    <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">

                      <div className="w-20 h-20 bg-gradient-to-r from-teal-600 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">

                        <span className="text-white font-bold text-2xl">{currentAdmin?.firstName.charAt(0)}{currentAdmin?.lastName.charAt(0)}</span>

                      </div>

                      <div>

                        <h3 className="text-2xl font-bold text-gray-900 text-center sm:text-left">{currentAdmin?.firstName} {currentAdmin?.lastName}</h3>

                        <p className="text-gray-600 text-center sm:text-left">{currentAdmin?.email}</p>

                        <div className="text-center sm:text-left mt-2">

                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${currentAdmin?.role === 'ELDER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{currentAdmin?.role}</span>

                        </div>

                      </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">

                      <div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>

                        <p className="text-gray-900">{currentAdmin?.firstName}</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>

                        <p className="text-gray-900">{currentAdmin?.lastName}</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>

                        <p className="text-gray-900">{currentAdmin?.email}</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>

                        <p className="text-gray-900">{currentAdmin?.phone || 'Not provided'}</p>

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>

                        <p className="text-gray-900">{currentAdmin?.role}</p>

                      </div>

                    </div>

                  </div>

                </div>

              )}

  

              {activeTab === 'security' && (

                <div className="max-w-2xl">

                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Change Password</h2>

                  {passwordMessage && (

                    <div className={`mb-6 p-4 rounded-lg flex items-start ${passwordMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>

                      <svg className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 20 20">

                        {passwordMessage.type === 'success' ? <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /> : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />}

                      </svg>

                      <p className={`font-medium ${passwordMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>{passwordMessage.text}</p>

                    </div>

                  )}

                  <form onSubmit={changePassword} className="space-y-6">

                    <div>

                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>

                      <input type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />

                    </div>

                    <div>

                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>

                      <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordInputChange} required minLength={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />

                      <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters long</p>

                    </div>

                    <div>

                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>

                      <input type="password" name="confirmNewPassword" value={passwordForm.confirmNewPassword} onChange={handlePasswordInputChange} required minLength={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none" />

                    </div>

                    <button type="submit" disabled={isChangingPassword} className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center">

                      {isChangingPassword ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Changing...</>) : (<><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Change Password</>)}

                    </button>

                  </form>

                </div>

              )}

  

              {activeTab === 'locations' && <LocationManagement />}

  

              {activeTab === 'admins' && currentAdmin?.role === 'ELDER' && (

                <div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">

                    <h2 className="text-xl font-semibold text-gray-900">Admin Accounts</h2>

                    <button onClick={() => setShowNewAdminModal(true)} className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all flex items-center justify-center">

                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>

                      Add New Admin

                    </button>

                  </div>

  

                  {loading ? (

                    <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div><p className="mt-4 text-gray-600">Loading admins...</p></div>

                  ) : (

                    <div>

                      {/* Mobile Card View */}

                      <div className="md:hidden space-y-4">

                        {admins.map((admin) => (

                          <div key={admin.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">

                            <div className="flex items-center justify-between">

                              <div className="flex items-center">

                                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">

                                  <span className="text-teal-600 font-semibold text-sm">{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span>

                                </div>

                                <div className="ml-3">

                                  <p className="text-sm font-medium text-gray-900">{admin.firstName} {admin.lastName}</p>

                                  <p className="text-sm text-gray-500">{admin.email}</p>

                                </div>

                              </div>

                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${admin.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{admin.isActive ? 'Active' : 'Inactive'}</span>

                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">

                               <div className="text-sm"><strong className="font-medium text-gray-600">Role:</strong> <span className={`px-2 py-1 text-xs font-medium rounded-full ${admin.role === 'ELDER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{admin.role}</span></div>

                              <div className="text-sm"><strong className="font-medium text-gray-600">Phone:</strong> {admin.phone || 'N/A'}</div>

                              <div className="text-sm"><strong className="font-medium text-gray-600">Last Login:</strong> {formatDate(admin.lastLogin)}</div>

                            </div>

                             {admin.id !== currentAdmin?.id && (

                              <div className="mt-4 pt-4 border-t border-gray-200">

                                <button onClick={() => toggleAdminStatus(admin.id, admin.isActive)} className={`w-full py-2 px-4 text-sm font-medium rounded-md ${admin.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>

                                  {admin.isActive ? 'Deactivate' : 'Activate'}

                                </button>

                              </div>

                            )}

                          </div>

                        ))}

                      </div>

  

                      {/* Desktop Table View */}

                      <div className="hidden md:block overflow-x-auto">

                        <table className="min-w-full divide-y divide-gray-200">

                          <thead className="bg-gray-50">

                            <tr>

                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>

                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>

                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>

                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>

                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>

                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>

                            </tr>

                          </thead>

                          <tbody className="bg-white divide-y divide-gray-200">

                            {admins.map((admin) => (

                              <tr key={admin.id} className="hover:bg-gray-50">

                                <td className="px-6 py-4 whitespace-nowrap">

                                  <div className="flex items-center">

                                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-teal-600 font-semibold text-sm">{admin.firstName.charAt(0)}{admin.lastName.charAt(0)}</span></div>

                                    <div className="ml-4">

                                      <div className="text-sm font-medium text-gray-900">{admin.firstName} {admin.lastName}</div>

                                      {admin.phone && <div className="text-sm text-gray-500">{admin.phone}</div>}

                                    </div>

                                  </div>

                                </td>

                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{admin.email}</div></td>

                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-medium rounded-full ${admin.role === 'ELDER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{admin.role}</span></td>

                                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 py-1 text-xs font-medium rounded-full ${admin.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{admin.isActive ? 'Active' : 'Inactive'}</span></td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(admin.lastLogin)}</td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">

                                  {admin.id !== currentAdmin?.id && <button onClick={() => toggleAdminStatus(admin.id, admin.isActive)} className={`${admin.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`} title={admin.isActive ? 'Deactivate' : 'Activate'}>{admin.isActive ? 'Deactivate' : 'Activate'}</button>}

                                </td>

                              </tr>

                            ))}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  )}

                </div>

              )}

            </div>

          </div>

        </div>

  

        {showNewAdminModal && (

          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full mx-auto">

              <div className="flex justify-between items-center mb-6">

                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Admin</h3>

                <button onClick={() => setShowNewAdminModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>

              </div>

              <form onSubmit={createNewAdmin} className="space-y-4 sm:space-y-6 max-h-[80vh] overflow-y-auto pr-2">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>

                    <input type="text" name="firstName" value={newAdminForm.firstName} onChange={handleNewAdminInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-red-500">*</span></label>

                    <input type="text" name="lastName" value={newAdminForm.lastName} onChange={handleNewAdminInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>

                    <input type="email" name="email" value={newAdminForm.email} onChange={handleNewAdminInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>

                    <input type="tel" name="phone" value={newAdminForm.phone} onChange={handleNewAdminInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                  </div>

                </div>

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>

                  <select name="role" value={newAdminForm.role} onChange={handleNewAdminInputChange} required className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white">

                    <option value="CLERK">Clerk</option>

                    <option value="ELDER">Elder</option>

                  </select>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Password <span className="text-red-500">*</span></label>

                    <input type="password" name="password" value={newAdminForm.password} onChange={handleNewAdminInputChange} required minLength={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                    <p className="mt-1 text-xs text-gray-500">Minimum 6 characters</p>

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password <span className="text-red-500">*</span></label>

                    <input type="password" name="confirmPassword" value={newAdminForm.confirmPassword} onChange={handleNewAdminInputChange} required minLength={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" />

                  </div>

                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-6 border-t">

                  <button type="button" onClick={() => setShowNewAdminModal(false)} className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">Cancel</button>

                  <button type="submit" disabled={isCreatingAdmin} className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">

                    {isCreatingAdmin ? (<><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Creating...</>) : (<><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Create Admin</>)}

                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

      </div>

    );

  }

  