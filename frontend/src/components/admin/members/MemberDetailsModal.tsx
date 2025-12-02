import { useEffect, useState, type JSX } from 'react';
import api from '../../../services/api';

interface MemberDetailsModalProps {
  memberId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface AttendanceRecord {
  id: string;
  attendedAt: string;
  serviceType: string;
  locationName: string;
  isVerified: boolean;
}

interface MemberStats {
  totalAttendances: number;
  recentAttendances: number;
  byServiceType: Record<string, number>;
}

interface MemberDetails {
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
  attendances: AttendanceRecord[];
  stats: MemberStats;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  SABBATH_MORNING: '🕊️ Sabbath Service',
  WEDNESDAY_VESPERS: '🌙 Wednesday Vespers',
  FRIDAY_VESPERS: '🌙 Friday Vespers',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  INACTIVE: 'bg-red-100 text-red-800 border-red-200',
  VISITOR: 'bg-blue-100 text-blue-800 border-blue-200',
};

const MINISTRY_COLORS: Record<string, string> = {
  FOJ: 'bg-teal-100 text-teal-800',
  ARK: 'bg-blue-100 text-blue-800',
  VINEYARD: 'bg-purple-100 text-purple-800',
  PILGRIMS: 'bg-orange-100 text-orange-800',
};

export default function MemberDetailsModal({ memberId, isOpen, onClose }: MemberDetailsModalProps) {
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && memberId) {
      fetchMemberDetails();
    }
  }, [isOpen, memberId]);

  const fetchMemberDetails = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/members/${memberId}`);

      if (response.data.success) {
        setMember(response.data.data);
      } else {
        throw new Error('Failed to load member details');
      }
    } catch (err) {
      console.error('Error fetching member details:', err);
      setError('Failed to load member details. Please try again.');
      setTimeout(onClose, 2000);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getMinistryColor = (ministry?: string): string => {
    return ministry ? MINISTRY_COLORS[ministry] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  };

  const getServiceTypeLabel = (type: string): string => {
    return SERVICE_TYPE_LABELS[type] || type;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-4 border-white/30">
                <span className="text-3xl font-bold">
                  {loading ? '...' : `${member?.firstName.charAt(0)}${member?.lastName.charAt(0)}`}
                </span>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-1">
                  {loading ? 'Loading...' : `${member?.firstName} ${member?.lastName}`}
                </h2>
                <p className="text-white/90 text-lg">{loading ? '' : member?.email}</p>
                {!loading && member?.isLeader && (
                  <span className="inline-flex items-center px-3 py-1 mt-2 bg-yellow-400 text-yellow-900 text-sm font-semibold rounded-full">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Church Leader
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-all"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
            <p className="text-gray-600">Loading member details...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        ) : member ? (
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard
                label="Total Attendance"
                value={member.stats.totalAttendances}
                icon={<CheckCircleIcon />}
                colorClass="from-teal-50 to-teal-100 border-teal-200"
                iconBgClass="bg-teal-200"
                iconColorClass="text-teal-700"
                textColorClass="text-teal-700"
                valueColorClass="text-teal-900"
              />

              <StatCard
                label="Last 30 Days"
                value={member.stats.recentAttendances}
                icon={<ClockIcon />}
                colorClass="from-blue-50 to-blue-100 border-blue-200"
                iconBgClass="bg-blue-200"
                iconColorClass="text-blue-700"
                textColorClass="text-blue-700"
                valueColorClass="text-blue-900"
              />

              <div className={`p-4 rounded-xl border-2 ${getStatusColor(member.membershipStatus)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">Membership Status</p>
                    <p className="text-2xl font-bold">{member.membershipStatus}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/50 rounded-full flex items-center justify-center">
                    <UserIcon />
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <InfoSection title="Personal Information" icon={<UserIcon />}>
                <InfoRow label="Phone" value={member.phone} icon={<PhoneIcon />} />
                <InfoRow label="Gender" value={member.gender} icon={<UserIcon />} />
                <InfoRow label="Date of Birth" value={formatDate(member.dateOfBirth)} icon={<CalendarIcon />} />
                <InfoRow label="Date Baptised" value={formatDate(member.dateBaptised)} icon={<DropletIcon />} />
                <InfoRow label="City" value={member.city} icon={<LocationIcon />} />
                <InfoRow label="Address" value={member.address} icon={<HomeIcon />} />
              </InfoSection>

              {/* Academic & Ministry */}
              <InfoSection title="Academic & Ministry" icon={<BookIcon />}>
                <InfoRow label="Faculty" value={member.faculty} icon={<BuildingIcon />} />
                <InfoRow label="Course" value={member.course} icon={<BookIcon />} />
                <InfoRow label="Year of Study" value={member.yearGroup} icon={<AcademicIcon />} />

                {member.ministry && (
                  <div className="flex items-start py-2">
                    <div className="w-5 h-5 text-gray-400 mr-3 mt-0.5">
                      <GroupIcon />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Ministry</p>
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${getMinistryColor(member.ministry)}`}>
                        {member.ministry}
                      </span>
                    </div>
                  </div>
                )}

                <InfoRow label="Date Joined" value={formatDate(member.dateJoined)} icon={<CalendarCheckIcon />} />
              </InfoSection>
            </div>

            {/* Attendance by Service Type */}
            {Object.keys(member.stats.byServiceType).length > 0 && (
              <div className="mt-6">
                <SectionHeader title="Attendance by Service" icon={<ChartIcon />} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(member.stats.byServiceType).map(([service, count]) => (
                    <div key={service} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">{getServiceTypeLabel(service)}</p>
                      <p className="text-2xl font-bold text-gray-900">{count} times</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Attendance */}
            {member.attendances && member.attendances.length > 0 && (
              <div className="mt-6">
                <SectionHeader title={`Recent Attendance (${member.attendances.length})`} icon={<ClockIcon />} />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {member.attendances.map((attendance) => (
                    <AttendanceItem
                      key={attendance.id}
                      attendance={attendance}
                      formatDateTime={formatDateTime}
                      getServiceTypeLabel={getServiceTypeLabel}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-600">Member details not available</p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// Helper Components
interface StatCardProps {
  label: string;
  value: number;
  icon: JSX.Element;
  colorClass: string;
  iconBgClass: string;
  iconColorClass: string;
  textColorClass: string;
  valueColorClass: string;
}

function StatCard({ label, value, icon, colorClass, iconBgClass, iconColorClass, textColorClass, valueColorClass }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClass} p-4 rounded-xl border`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${textColorClass} font-medium`}>{label}</p>
          <p className={`text-3xl font-bold ${valueColorClass}`}>{value}</p>
        </div>
        <div className={`w-12 h-12 ${iconBgClass} rounded-full flex items-center justify-center`}>
          <div className={`w-6 h-6 ${iconColorClass}`}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

interface InfoSectionProps {
  title: string;
  icon: JSX.Element;
  children: React.ReactNode;
}

function InfoSection({ title, icon, children }: InfoSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900 flex items-center border-b pb-2">
        <div className="w-5 h-5 mr-2 text-teal-600">{icon}</div>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  icon: JSX.Element;
}

function SectionHeader({ title, icon }: SectionHeaderProps) {
  return (
    <h3 className="text-lg font-bold text-gray-900 flex items-center border-b pb-2 mb-4">
      <div className="w-5 h-5 mr-2 text-teal-600">{icon}</div>
      {title}
    </h3>
  );
}

interface InfoRowProps {
  label: string;
  value?: string;
  icon: JSX.Element;
}

function InfoRow({ label, value, icon }: InfoRowProps) {
  if (!value || value === 'N/A') return null;

  return (
    <div className="flex items-start py-2">
      <div className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-gray-900 font-medium">{value}</p>
      </div>
    </div>
  );
}

interface AttendanceItemProps {
  attendance: AttendanceRecord;
  formatDateTime: (date?: string) => string;
  getServiceTypeLabel: (type: string) => string;
}

function AttendanceItem({ attendance, formatDateTime, getServiceTypeLabel }: AttendanceItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-medium text-gray-900">{getServiceTypeLabel(attendance.serviceType)}</p>
          <p className="text-sm text-gray-500">{attendance.locationName}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-700">{formatDateTime(attendance.attendedAt)}</p>
        {attendance.isVerified && (
          <span className="inline-flex items-center text-xs text-green-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        )}
      </div>
    </div>
  );
}

// Icon Components
function CheckCircleIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function AcademicIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l2 2 4-4" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}