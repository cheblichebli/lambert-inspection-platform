import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authAPI, syncAPI } from './api';
import Login from './components/Login';
import Navigation from './components/Navigation';
import './App.css';

// Lazy-loaded route components — each loads only when first visited
const Dashboard = lazy(() => import('./components/Dashboard'));
const InspectionList = lazy(() => import('./components/InspectionList'));
const InspectionForm = lazy(() => import('./components/InspectionForm'));
const InspectionDetail = lazy(() => import('./components/InspectionDetail'));
const FormBuilder = lazy(() => import('./components/FormBuilder'));
const FormList = lazy(() => import('./components/FormList'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AuditLogs = lazy(() => import('./components/AuditLogs'));
const CorrectiveActions = lazy(() => import('./components/CorrectiveActions'));
const Schedule = lazy(() => import('./components/Schedule'));

// Fallback shown while a lazy component is loading
function PageLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

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

        <div className={user ? "main-content" : "login-page-wrapper"}>
          <Suspense fallback={<PageLoader />}>
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

              {/* Schedule — all roles can view */}
              <Route
                path="/schedule"
                element={user ? <Schedule user={user} /> : <Navigate to="/login" />}
              />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </Router>
  );
}

export default App;
