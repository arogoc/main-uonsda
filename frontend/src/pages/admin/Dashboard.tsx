import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Types
interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
  phone?: string;
}

interface MinistryStat {
  ministry: string;
  count: number;
}

interface GenderStat {
  gender: string;
  count: number;
}

interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  visitorMembers: number;
  leadersCount: number;
  recentRegistrations: number;
  membersByMinistry: MinistryStat[];
  membersByGender: GenderStat[];
}

const MINISTRY_COLORS = ['teal', 'blue', 'purple', 'orange', 'indigo', 'pink'] as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const adminData = localStorage.getItem('admin');
        if (adminData) {
          setAdmin(JSON.parse(adminData));
        }

        const { data } = await api.get<{ success: boolean; data: MemberStats }>('/api/members/stats/overview');
        if (data.success) {
          setStats(data.data);
        }
      } catch (error: any) {
        console.error('Failed to load dashboard:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          handleLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  const adminInitials = useMemo(() => {
    if (!admin) return '';
    return `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`.toUpperCase();
  }, [admin]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
          <p className="mt-4 text-lg font-medium text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!admin || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Unable to load dashboard data.</p>
          <button onClick={handleLogout} className="mt-4 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900">UONSDA Admin</span>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-700">
                  {adminInitials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{admin.firstName} {admin.lastName}</p>
                  <p className="text-xs text-gray-500 capitalize">{admin.role.toLowerCase()}</p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-4">
              <div className="flex items-center space-x-3 px-4 py-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-700">
                  {adminInitials}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{admin.firstName} {admin.lastName}</p>
                  <p className="text-sm text-gray-500 capitalize">{admin.role.toLowerCase()}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back, {admin.firstName}!</h1>
          <p className="mt-2 text-gray-600">Here's an overview of your church community.</p>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Members', value: stats.totalMembers, color: 'teal' },
            { label: 'Active Members', value: stats.activeMembers, color: 'green' },
            { label: 'Inactive Members', value: stats.inactiveMembers, color: 'orange' },
            { label: 'New (30 days)', value: stats.recentRegistrations, color: 'blue' },
          ].map((stat) => (
            <div key={stat.label} className={`bg-white rounded-xl shadow-sm p-6 border-l-4 border-${stat.color}-500`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-${stat.color}-100 rounded-full flex items-center justify-center`}>
                  <svg className={`w-7 h-7 text-${stat.color}-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {stat.label.includes('Total') && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
                    {stat.label.includes('Active') && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    {stat.label.includes('Inactive') && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                    {stat.label.includes('New') && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />}
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ministry Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
              <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Members by Ministry
            </h3>
            {stats.membersByMinistry.length > 0 ? (
              <div className="space-y-4">
                {stats.membersByMinistry.map((item, idx) => {
                  const percentage = stats.totalMembers ? Math.round((item.count / stats.totalMembers) * 100) : 0;
                  const color = MINISTRY_COLORS[idx % MINISTRY_COLORS.length];

                  return (
                    <div key={item.ministry}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.ministry || 'Unassigned'}</span>
                        <span className="text-gray-600">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`bg-${color}-600 h-2.5 rounded-full transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No ministry data available</p>
            )}
          </div>

          {/* Gender Distribution */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center">
              <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Gender Distribution
            </h3>
            {stats.membersByGender.length > 0 ? (
              <div className="space-y-4">
                {stats.membersByGender.map((item) => {
                  const percentage = stats.totalMembers ? Math.round((item.count / stats.totalMembers) * 100) : 0;
                  const bgColor = item.gender === 'MALE' ? 'bg-blue-600' : item.gender === 'FEMALE' ? 'bg-pink-600' : 'bg-gray-600';

                  return (
                    <div key={item.gender}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{item.gender || 'Not Specified'}</span>
                        <span className="text-gray-600">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`${bgColor} h-2.5 rounded-full transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No gender data available</p>
            )}
          </div>
        </section>

        
        {/* Quick Actions */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              {
                to: '/admin/members',
                label: 'View Members',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
                gradient: 'from-teal-50 to-teal-100',
                hover: 'hover:from-teal-100 hover:to-teal-200',
                iconBg: 'bg-teal-500'
              },
              {
                to: '/admin/attendance',
                label: 'Attendance',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
                gradient: 'from-orange-50 to-orange-100',
                hover: 'hover:from-orange-100 hover:to-orange-200',
                iconBg: 'bg-orange-500'
              },
              {
                to: '/admin/settings',
                label: 'Settings',
                icon: (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </>
                ),
                gradient: 'from-purple-50 to-purple-100',
                hover: 'hover:from-purple-100 hover:to-purple-200',
                iconBg: 'bg-purple-500'
              },
              {
                to: '/register',
                label: 'Add Member',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
                gradient: 'from-blue-50 to-blue-100',
                hover: 'hover:from-blue-100 hover:to-blue-200',
                iconBg: 'bg-blue-500'
              },
              {
                to: '/admin/communion',
                label: 'Communion',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />,
                gradient: 'from-indigo-50 to-indigo-100',
                hover: 'hover:from-indigo-100 hover:to-indigo-200',
                iconBg: 'bg-indigo-500'
              },
              {
                to: '/admin/reports',
                label: 'Reports',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
                gradient: 'from-pink-50 to-pink-100',
                hover: 'hover:from-pink-100 hover:to-pink-200',
                iconBg: 'bg-pink-500'
              },
            ].map((action) => (
              <button
                key={action.to}
                onClick={() => navigate(action.to)}
                className={`
                  group relative p-4 rounded-xl
                  bg-gradient-to-br ${action.gradient} ${action.hover}
                  transition-all duration-300 ease-out
                  shadow-sm hover:shadow-lg hover:-translate-y-1
                  flex flex-col justify-between
                  text-left
                `}
              >
                {/* Icon Container */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`
                    w-10 h-10 ${action.iconBg} rounded-lg
                    flex items-center justify-center
                    shadow-md group-hover:scale-110
                    transition-transform duration-300
                  `}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {action.icon}
                    </svg>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Text */}
                <h4 className="font-semibold text-gray-900 text-sm leading-tight">{action.label}</h4>
                <p className="text-xs text-gray-600 mt-1">Quick access</p>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}