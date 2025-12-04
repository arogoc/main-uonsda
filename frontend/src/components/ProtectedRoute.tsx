import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('ELDER' | 'CLERK' | 'PASTORATE')[]; 
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = localStorage.getItem('token');
  const adminData = localStorage.getItem('admin');

  // Check if user is authenticated
  if (!token || !adminData) {
    return <Navigate to="/admin/login" replace />;
  }

  // If roles are specified, check if user has permission
  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const admin = JSON.parse(adminData);
      if (!allowedRoles.includes(admin.role)) {
        // ✅ Smart redirect based on user's actual role
        const redirectPath = admin.role === 'PASTORATE' ? '/admin/pastorate' : '/admin/dashboard';
        
        return (
          <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">This page requires a PASTORATE account. Ensure you're logged in with a PASTORATE account to access this feature.</p>
              <a 
                href={redirectPath} 
                className="inline-block px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
              >
                Go to {admin.role === 'PASTORATE' ? 'Pastorate Dashboard' : 'Dashboard'}
              </a>
            </div>
          </div>
        );
      }
    } catch (error) {
      console.error('Error parsing admin data:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      return <Navigate to="/admin/login" replace />;
    }
  }

  return <>{children}</>;
}