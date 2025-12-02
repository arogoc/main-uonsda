import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register'
import QRCodePage from './pages/QRCode';;
import AdminLogin from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Members from './pages/admin/Members';
import Settings from './pages/admin/Settings';
import Attendance from './pages/admin/Attendance';
import Communion from './pages/admin/Communion';
import Reports from './pages/admin/Reports';
import ProtectedRoute from './components/ProtectedRoute';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/qr-code" element={<QRCodePage />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Protected Admin Routes */}
        <Route 
          path="/admin/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin/members" 
          element={
            <ProtectedRoute>
              <Members />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/attendance" 
          element={
            <ProtectedRoute>
              <Attendance />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/communion" 
          element={
            <ProtectedRoute>
              <Communion />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/reports" 
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;