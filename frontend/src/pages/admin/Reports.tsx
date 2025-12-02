import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ReportService } from '../../services/reportService';

interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ELDER' | 'CLERK';
}

export default function Reports() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    reportType: 'comprehensive',
    startDate: '',
    endDate: '',
    ministry: '',
    yearGroup: '',
    serviceType: '',
    membershipStatus: ''
  });

  useState(() => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      setAdmin(JSON.parse(adminData));
    }
  });

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const generateReport = async (format: 'pdf' | 'excel') => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);

      let endpoint = '';
      let reportTitle = '';

      switch (filters.reportType) {
        case 'members':
          endpoint = '/api/reports/members';
          reportTitle = 'Members Directory Report';
          break;
        case 'attendance':
          endpoint = '/api/reports/attendance';
          reportTitle = 'Attendance Report';
          break;
        case 'communion':
          endpoint = '/api/reports/communion';
          reportTitle = 'Holy Communion Report';
          break;
        case 'comprehensive':
          endpoint = '/api/reports/comprehensive';
          reportTitle = 'Comprehensive Church Report';
          break;
        default:
          endpoint = '/api/reports/comprehensive';
          reportTitle = 'Church Report';
      }

      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.ministry) params.append('ministry', filters.ministry);
      if (filters.yearGroup) params.append('yearGroup', filters.yearGroup);
      if (filters.serviceType) params.append('serviceType', filters.serviceType);
      if (filters.membershipStatus) params.append('membershipStatus', filters.membershipStatus);

      const response = await api.get(`${endpoint}?${params.toString()}`);

      if (response.data.success) {
        const reportData = {
          ...response.data.data,
          filters: {
            ...filters,
            reportType: filters.reportType
          }
        };

        if (format === 'pdf') {
          ReportService.generatePDF(reportData, reportTitle);
        } else {
          ReportService.generateExcel(reportData, reportTitle);
        }
      }
    } catch (error: any) {
      console.error('Error generating report:', error);
      alert(error.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

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
                onClick={() => navigate('/admi')}
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate Reports</h1>
          <p className="text-gray-600">Create professional PDF and Excel reports</p>
        </div>

        {/* Report Configuration */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Report Configuration</h2>

          <div className="space-y-6">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type <span className="text-red-500">*</span>
              </label>
              <select
                value={filters.reportType}
                onChange={(e) => handleFilterChange('reportType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
              >
                <option value="comprehensive">Comprehensive Report (All Data)</option>
                <option value="members">Members Directory</option>
                <option value="attendance">Attendance Report</option>
                <option value="communion">Communion Report</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {filters.reportType === 'comprehensive' && 'Includes members, attendance, and communion data'}
                {filters.reportType === 'members' && 'Member information and statistics'}
                {filters.reportType === 'attendance' && 'Service attendance records'}
                {filters.reportType === 'communion' && 'Communion participation records'}
              </p>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Optional Filters */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Optional Filters</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Ministry Filter */}
                {(filters.reportType === 'comprehensive' || filters.reportType === 'members') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ministry
                    </label>
                    <select
                      value={filters.ministry}
                      onChange={(e) => handleFilterChange('ministry', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">All Ministries</option>
                      <option value="FOJ">Friends of Jesus</option>
                      <option value="ARK">Ark</option>
                      <option value="VINEYARD">Vineyard</option>
                      <option value="PILGRIMS">Pilgrims</option>
                    </select>
                  </div>
                )}

                {/* Year Group Filter */}
                {(filters.reportType === 'comprehensive' || filters.reportType === 'members') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Year Group
                    </label>
                    <select
                      value={filters.yearGroup}
                      onChange={(e) => handleFilterChange('yearGroup', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">All Years</option>
                      <option value="Year 1">Year 1</option>
                      <option value="Year 2">Year 2</option>
                      <option value="Year 3">Year 3</option>
                      <option value="Year 4">Year 4</option>
                      <option value="Year 5">Year 5</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                )}

                {/* Service Type Filter */}
                {(filters.reportType === 'comprehensive' || filters.reportType === 'attendance') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Type
                    </label>
                    <select
                      value={filters.serviceType}
                      onChange={(e) => handleFilterChange('serviceType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">All Services</option>
                      <option value="SABBATH_MORNING">Sabbath Service</option>
                      <option value="WEDNESDAY_VESPERS">Wednesday Vespers</option>
                      <option value="FRIDAY_VESPERS">Friday Vespers</option>
                    </select>
                  </div>
                )}

                {/* Membership Status Filter */}
                {filters.reportType === 'members' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Membership Status
                    </label>
                    <select
                      value={filters.membershipStatus}
                      onChange={(e) => handleFilterChange('membershipStatus', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="VISITOR">Visitor</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Date Ranges</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 30);
                    handleFilterChange('startDate', thirtyDaysAgo.toISOString().split('T')[0]);
                    handleFilterChange('endDate', today.toISOString().split('T')[0]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    handleFilterChange('startDate', startOfMonth.toISOString().split('T')[0]);
                    handleFilterChange('endDate', today.toISOString().split('T')[0]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  This Month
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                    handleFilterChange('startDate', lastMonth.toISOString().split('T')[0]);
                    handleFilterChange('endDate', endOfLastMonth.toISOString().split('T')[0]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Last Month
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const startOfYear = new Date(today.getFullYear(), 0, 1);
                    handleFilterChange('startDate', startOfYear.toISOString().split('T')[0]);
                    handleFilterChange('endDate', today.toISOString().split('T')[0]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  This Year
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const oneYearAgo = new Date(today);
                    oneYearAgo.setFullYear(today.getFullYear() - 1);
                    handleFilterChange('startDate', oneYearAgo.toISOString().split('T')[0]);
                    handleFilterChange('endDate', today.toISOString().split('T')[0]);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Last Year
                </button>
              </div>
            </div>

            {/* Generate Buttons */}
            <div className="border-t pt-6 mt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => generateReport('pdf')}
                  disabled={loading || !filters.startDate || !filters.endDate}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-lg hover:from-red-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Generate PDF Report
                    </>
                  )}
                </button>

                <button
                  onClick={() => generateReport('excel')}
                  disabled={loading || !filters.startDate || !filters.endDate}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Generate Excel Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900">About PDF Reports</h3>
                <p className="mt-2 text-sm text-blue-700">
                  PDF reports are professionally formatted with tables, statistics, and the church logo. 
                  Perfect for presentations and official documentation.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-900">About Excel Reports</h3>
                <p className="mt-2 text-sm text-green-700">
                  Excel reports contain multiple sheets with raw data that you can further analyze, 
                  filter, and customize using spreadsheet software.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}