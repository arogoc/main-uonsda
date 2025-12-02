import { useState, useEffect } from 'react';
import api from '../services/api';

interface ActiveService {
  id: string;
  serviceDate: string;
  quarter: number;
  year: number;
  location: string | null;
  notes: string | null;
  totalParticipants: number;
}

export default function CommunionParticipation() {
  const [activeService, setActiveService] = useState<ActiveService | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [participantType, setParticipantType] = useState<'MEMBER' | 'VISITOR'>('MEMBER');
  const [formData, setFormData] = useState({
    email: '',
    visitorName: '',
    visitorChurch: '',
    visitorPhone: '',
    visitorEmail: ''
  });

  useEffect(() => {
    checkActiveCommunion();
  }, []);

  const checkActiveCommunion = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/communion/active');
      if (response.data.success) {
        setActiveService(response.data.data);
      }
    } catch (error) {
      console.error('Error checking active communion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await api.post('/api/communion/participate', {
        participantType,
        ...(participantType === 'MEMBER' 
          ? { email: formData.email }
          : {
              visitorName: formData.visitorName,
              visitorChurch: formData.visitorChurch,
              visitorPhone: formData.visitorPhone,
              visitorEmail: formData.visitorEmail
            }
        )
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setFormData({
          email: '',
          visitorName: '',
          visitorChurch: '',
          visitorPhone: '',
          visitorEmail: ''
        });
        // Refresh active service to update participant count
        checkActiveCommunion();
      }
    } catch (error: any) {
      console.error('Error participating in communion:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to register for communion'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        <p className="mt-4 text-gray-600">Checking for active communion service...</p>
      </div>
    );
  }

  if (!activeService) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Communion Service</h3>
        <p className="text-gray-600">
          There is currently no communion service open for registration. Please check back later or contact church administration.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Holy Communion Registration</h3>
        <p className="text-gray-600">{formatDate(activeService.serviceDate)}</p>
        {activeService.location && (
          <p className="text-sm text-gray-500 mt-1">📍 {activeService.location}</p>
        )}
      </div>

      {/* Service Info */}
      <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-purple-900">Q{activeService.quarter} {activeService.year}</p>
            {activeService.notes && (
              <p className="text-xs text-purple-700 mt-1">{activeService.notes}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-700">{activeService.totalParticipants}</p>
            <p className="text-xs text-purple-600">Registered</p>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 border border-red-200' :
          'bg-blue-50 border border-blue-200'
        }`}>
          <svg className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
            message.type === 'success' ? 'text-green-600' :
            message.type === 'error' ? 'text-red-600' :
            'text-blue-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {message.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          <p className={`font-medium ${
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Participation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Participant Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            I am a <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setParticipantType('MEMBER')}
              className={`p-4 border-2 rounded-lg transition-all ${
                participantType === 'MEMBER'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-center">
                <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                  participantType === 'MEMBER' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-6 h-6 ${
                    participantType === 'MEMBER' ? 'text-green-600' : 'text-gray-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="font-medium text-sm text-green-600">UONSDA Member</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setParticipantType('VISITOR')}
              className={`p-4 border-2 rounded-lg transition-all ${
                participantType === 'VISITOR'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-center">
                <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
                  participantType === 'VISITOR' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-6 h-6 ${
                    participantType === 'VISITOR' ? 'text-orange-600' : 'text-gray-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="font-medium text-sm text-orange-600">Visitor</p>
              </div>
            </button>
          </div>
        </div>

        {/* Member Form */}
        {participantType === 'MEMBER' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              required
              disabled={isSubmitting}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100"
              placeholder="your.email@students.uonbi.ac.ke"
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the email you used when registering as a member
            </p>
          </div>
        )}

        {/* Visitor Form */}
        {participantType === 'VISITOR' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.visitorName}
                onChange={(e) => setFormData(prev => ({ ...prev, visitorName: e.target.value }))}
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-100"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Home Church
              </label>
              <input
                type="text"
                value={formData.visitorChurch}
                onChange={(e) => setFormData(prev => ({ ...prev, visitorChurch: e.target.value }))}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-100"
                placeholder="e.g., Central SDA Church"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.visitorPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitorPhone: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  placeholder="+254 712 345 678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.visitorEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, visitorEmail: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:bg-gray-100"
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Registering...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Register for Communion
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-600">
          May the Lord bless you as you partake in this holy sacrament
        </p>
      </form>
    </div>
  );
}