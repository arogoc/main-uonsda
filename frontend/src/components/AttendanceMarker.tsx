import { useState, useEffect } from 'react';
import api from '../services/api';

interface ServiceStatus {
  isServiceTime: boolean;
  currentService: string | null;
  churchLocation: {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    radius: number;
    address: string;
  } | null;
  schedule: {
    sabbath: { day: string; time: string; type: string };
    wednesdayVespers: { day: string; time: string; type: string };
    fridayVespers: { day: string; time: string; type: string };
  };
}

/**
 * Generate or retrieve device fingerprint
 * This creates a unique ID for each device to prevent fraud
 */
function getDeviceFingerprint(): string {
  const stored = localStorage.getItem('deviceId');
  if (stored) return stored;
  
  // Create a unique fingerprint combining timestamp and random string
  const fingerprint = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('deviceId', fingerprint);
  return fingerprint;
}

export default function AttendanceMarker() {
  const [email, setEmail] = useState('');
  const [isMarking, setIsMarking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    try {
      const response = await api.get('/api/attendance/status');
      if (response.data.success) {
        setServiceStatus(response.data.data);
      }
    } catch (error) {
      console.error('Error checking service status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const getLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          let errorMessage = 'Unable to get your location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your device settings.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  };

  const markAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setIsMarking(true);

    try {
      // Step 1: Get user's location
      setMessage({ type: 'info', text: '📍 Getting your location...' });
      const position = await getLocation();

      // Step 2: Get device fingerprint
      const deviceId = getDeviceFingerprint();

      // Step 3: Mark attendance (ONE API CALL!)
      setMessage({ type: 'info', text: '✅ Marking attendance...' });
      const response = await api.post('/api/attendance/mark', {
        email,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        deviceId
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        setEmail(''); // Clear email field on success
      }
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to mark attendance';
      const hint = error.response?.data?.hint;
      
      setMessage({ 
        type: 'error', 
        text: hint ? `${errorMessage}\n\n💡 ${hint}` : errorMessage
      });
    } finally {
      setIsMarking(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        <p className="mt-4 text-gray-600">Loading service status...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Quick Attendance</h3>
        <p className="text-gray-600">
          {serviceStatus?.isServiceTime ? (
            <span className="text-green-600 font-semibold">
              ✅ Service is in session! Mark your attendance now.
            </span>
          ) : (
            <span className="text-orange-600">
              ⏰ Attendance can only be marked during service times.
            </span>
          )}
        </p>
      </div>

      {/* Service Status Badge */}
      {serviceStatus?.isServiceTime && serviceStatus.currentService && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800 font-medium">
              {serviceStatus.currentService === 'SABBATH_MORNING' && '🕊️ Sabbath Service'}
              {serviceStatus.currentService === 'WEDNESDAY_VESPERS' && '🌙 Wednesday Vespers'}
              {serviceStatus.currentService === 'FRIDAY_VESPERS' && '🌙 Friday Vespers'}
            </span>
          </div>
          {serviceStatus.churchLocation && (
            <p className="text-center text-sm text-green-700 mt-2">
              📍 {serviceStatus.churchLocation.name}
            </p>
          )}
        </div>
      )}

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
            ) : message.type === 'error' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          <p className={`font-medium whitespace-pre-line ${
            message.type === 'success' ? 'text-green-800' :
            message.type === 'error' ? 'text-red-800' :
            'text-blue-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Simple One-Click Form */}
      {serviceStatus?.isServiceTime ? (
        <form onSubmit={markAttendance} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isMarking}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="your.email@students.uonbi.ac.ke"
            />
            <p className="mt-2 text-xs text-gray-500">
              📧 Enter the email you used when registering as a member
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">📱 One Device Per Person</p>
                <p>Each member must use their own device to mark attendance. This prevents someone from marking attendance for multiple people.</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">📍 Location Required</p>
                <p>You must be within {serviceStatus.churchLocation?.radius || 100}m of the church. Make sure location services are enabled on your device.</p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isMarking}
            className="w-full px-6 py-4 bg-gradient-to-r from-teal-600 to-blue-600 text-white font-bold rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
          >
            {isMarking ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Marking Attendance...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Attendance Now
              </>
            )}
          </button>
        </form>
      ) : (
        /* Not Service Time - Show Schedule */
        <div className="text-center py-8">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Not Currently Service Time</h4>
          <p className="text-gray-600 mb-6">Attendance can be marked during these times:</p>
          
          <div className="space-y-3 text-left max-w-md mx-auto">
            <div className="flex items-start p-3 bg-gray-50 rounded-lg">
              <svg className="w-5 h-5 text-teal-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">{serviceStatus?.schedule?.sabbath?.day || 'Saturday'}</p>
                <p className="text-sm text-gray-600">{serviceStatus?.schedule?.sabbath?.time || '9:00 AM - 12:00 PM'}</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-gray-50 rounded-lg">
              <svg className="w-5 h-5 text-teal-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">{serviceStatus?.schedule?.wednesdayVespers?.day || 'Wednesday'} Vespers</p>
                <p className="text-sm text-gray-600">{serviceStatus?.schedule?.wednesdayVespers?.time || '5:00 PM - 7:00 PM'}</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-gray-50 rounded-lg">
              <svg className="w-5 h-5 text-teal-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-gray-900">{serviceStatus?.schedule?.fridayVespers?.day || 'Friday'} Vespers</p>
                <p className="text-sm text-gray-600">{serviceStatus?.schedule?.fridayVespers?.time || '5:00 PM - 7:00 PM'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}