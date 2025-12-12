import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius: number;
  address?: string;
  isActiveSabbath: boolean;
  isActiveWednesday: boolean;
  isActiveFriday: boolean;
  createdAt: string;
}

interface NewLocationForm {
  name: string;
  description: string;
  latitude: string;
  longitude: string;
  radius: string;
  address: string;
}

export default function LocationManagement() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewLocationModal, setShowNewLocationModal] = useState(false);
  const [newLocationForm, setNewLocationForm] = useState<NewLocationForm>({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    radius: '100',
    address: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/attendance/locations');
      if (response.data.success) {
        setLocations(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLocationForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setNewLocationForm(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          }));
          setMessage({ type: 'success', text: 'Current location captured!' });
        },
        () => {
          setMessage({ type: 'error', text: 'Unable to get current location' });
        }
      );
    } else {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
    }
  };

  const createLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setMessage(null);

    try {
      const response = await api.post('/api/attendance/locations', {
        name: newLocationForm.name,
        description: newLocationForm.description || undefined,
        latitude: parseFloat(newLocationForm.latitude),
        longitude: parseFloat(newLocationForm.longitude),
        radius: parseInt(newLocationForm.radius),
        address: newLocationForm.address || undefined
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Location created successfully!' });
        setShowNewLocationModal(false);
        setNewLocationForm({
          name: '',
          description: '',
          latitude: '',
          longitude: '',
          radius: '100',
          address: ''
        });
        fetchLocations();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create location' });
    } finally {
      setIsCreating(false);
    }
  };

  const setActiveForServices = async (locationId: string, services: string[]) => {
    try {
      const response = await api.put(`/api/attendance/locations/${locationId}/activate`, {
        services
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        fetchLocations();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to activate location' });
    }
  };

  const deleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const response = await api.delete(`/api/attendance/locations/${locationId}`);
      if (response.data.success) {
        setMessage({ type: 'success', text: 'Location deleted successfully' });
        fetchLocations();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete location' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Church Locations</h2>
          <p className="text-sm text-gray-600 mt-1">Manage venues for different services</p>
        </div>
        <button
          onClick={() => setShowNewLocationModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Location
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-start ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <svg className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {message.type === 'success' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            )}
          </svg>
          <p className={`font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          <p className="mt-4 text-gray-600">Loading locations...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No locations yet</h3>
          <p className="text-gray-600">Add your first church location to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map((location) => (
            <div key={location.id} className="bg-white border rounded-xl p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{location.name}</h3>
                  {location.description && (
                    <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                  )}
                  {location.address && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {location.address}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => deleteLocation(location.id)}
                  className="text-red-600 hover:text-red-800 p-2"
                  title="Delete location"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-600">Coordinates:</span>
                  <p className="font-mono text-gray-900">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Radius:</span>
                  <p className="text-gray-900">{location.radius}m</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Active for services:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const services = location.isActiveSabbath ? [] : ['SABBATH_MORNING'];
                      setActiveForServices(location.id, services);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      location.isActiveSabbath
                        ? 'bg-teal-600 text-white shadow-md hover:bg-teal-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {location.isActiveSabbath ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Sabbath Active
                        </>
                      ) : (
                        'Activate Sabbath'
                      )}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const services = location.isActiveWednesday ? [] : ['WEDNESDAY_VESPERS'];
                      setActiveForServices(location.id, services);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      location.isActiveWednesday
                        ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {location.isActiveWednesday ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Wednesday Active
                        </>
                      ) : (
                        'Activate Wednesday'
                      )}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      const services = location.isActiveFriday ? [] : ['FRIDAY_VESPERS'];
                      setActiveForServices(location.id, services);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      location.isActiveFriday
                        ? 'bg-purple-600 text-white shadow-md hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {location.isActiveFriday ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Friday Active
                        </>
                      ) : (
                        'Activate Friday'
                      )}
                    </span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Click to {location.isActiveSabbath || location.isActiveWednesday || location.isActiveFriday ? 'deactivate or activate' : 'activate'} services
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Location Modal */}
      {showNewLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Add New Location</h3>
              <button
                onClick={() => {
                  setShowNewLocationModal(false);
                  setNewLocationForm({
                    name: '',
                    description: '',
                    latitude: '',
                    longitude: '',
                    radius: '100',
                    address: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={createLocation} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={newLocationForm.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="e.g., Main Campus Church"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={newLocationForm.description}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="Brief description of the venue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  name="address"
                  value={newLocationForm.address}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="Physical address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="latitude"
                    value={newLocationForm.latitude}
                    onChange={handleInputChange}
                    required
                    step="any"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="-1.2794"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="longitude"
                    value={newLocationForm.longitude}
                    onChange={handleInputChange}
                    required
                    step="any"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="36.8156"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={getCurrentLocation}
                className="w-full px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Use My Current Location
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-in Radius (meters) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="radius"
                  value={newLocationForm.radius}
                  onChange={handleInputChange}
                  required
                  min="10"
                  max="500"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                  placeholder="100"
                />
                <p className="mt-1 text-xs text-gray-500">Members must be within this radius to mark attendance</p>
              </div>

              <div className="flex space-x-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewLocationModal(false);
                    setNewLocationForm({
                      name: '',
                      description: '',
                      latitude: '',
                      longitude: '',
                      radius: '100',
                      address: ''
                    });
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 text-white rounded-lg hover:from-teal-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isCreating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Location'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}