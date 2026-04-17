import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import UploadsView from './pages/UploadsView';
import TeacherAnalysis from './pages/TeacherAnalysis';
import './index.css';

// Simple PrivateRoute component
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/teacher-analysis" element={
          <PrivateRoute>
            <TeacherAnalysis />
          </PrivateRoute>
        } />
        <Route path="/upload" element={<Upload />} />
        <Route path="/uploads" element={<UploadsView />} />
      </Routes>
    </Router>
  );
}

export default App;
