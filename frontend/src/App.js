import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authAPI, syncAPI } from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import InspectionList from './components/InspectionList';
import InspectionForm from './components/InspectionForm';
import InspectionDetail from './components/InspectionDetail';
import FormBuilder from './components/FormBuilder';
import FormList from './components/FormList';
import UserManagement from './components/UserManagement';
import Navigation from './components/Navigation';
import AdminDashboard from './components/AdminDashboard';
import AuditLogs from './components/AuditLogs';
import CorrectiveActions from './components/CorrectiveActions';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Only download offline data if cache is stale (older than 5 minutes)
    // Prevents a multi-MB sync request on every single page load/refresh
    if (currentUser && navigator.onLine) {
      const lastSync = localStorage.getItem('lastOfflineSync');
      const FIVE_MIN = 5 * 60 * 1000;
      const isStale = !lastSync || (Date.now() - parseInt(lastSync)) > FIVE_MIN;
      if (isStale) {
        syncAPI.downloadOfflineData()
          .then(() => localStorage.setItem('lastOfflineSync', Date.now().toString()))
          .catch(console.error);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (currentUser) {
        syncAPI.syncInspections()
          .then(() => syncAPI.downloadOfflineData())
          .then(() => localStorage.setItem('lastOfflineSync', Date.now().toString()))
          .catch(console.error);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = () => {
    authAPI.logout();
    localStorage.removeItem('lastOfflineSync');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        {user && <Navigation user={user} onLogout={handleLogout} isOnline={isOnline} />}

        <div className="main-content">
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />}
            />

            <Route
              path="/"
              element={user ? <Dashboard user={user} /> : <Navigate to="/login" />}
            />

            <Route
              path="/admin"
              element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/audit-logs"
              element={user?.role === 'admin' ? <AuditLogs /> : <Navigate to="/dashboard" />}
            />

            <Route
              path="/inspections"
              element={user ? <InspectionList user={user} /> : <Navigate to="/login" />}
            />

            <Route
              path="/inspections/new"
              element={user ? <InspectionForm user={user} /> : <Navigate to="/login" />}
            />

            <Route
              path="/inspections/:id"
              element={user ? <InspectionDetail user={user} /> : <Navigate to="/login" />}
            />

            <Route
              path="/forms"
              element={
                user && ['admin', 'supervisor'].includes(user.role) ? (
                  <FormList user={user} />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            <Route
              path="/forms/new"
              element={
                user && user.role === 'admin' ? (
                  <FormBuilder />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            <Route
              path="/forms/:id/edit"
              element={
                user && user.role === 'admin' ? (
                  <FormBuilder />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            <Route
              path="/users"
              element={
                user && user.role === 'admin' ? (
                  <UserManagement />
                ) : (
                  <Navigate to="/" />
                )
              }
            />

            {/* CAPA — all roles, scoped by backend */}
            <Route
              path="/capa"
              element={user ? <CorrectiveActions user={user} /> : <Navigate to="/login" />}
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
