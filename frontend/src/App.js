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
import SyncStatus from './components/SyncStatus';
import AdminDashboard from './components/AdminDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Check authentication
    const currentUser = authAPI.getCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // Download offline data if user is logged in and online
    if (currentUser && navigator.onLine) {
      syncAPI.downloadOfflineData().catch(console.error);
    }

    // Online/offline event listeners
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (currentUser) {
        syncAPI.syncInspections()
          .then(() => syncAPI.downloadOfflineData())
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
        {user && <Navigation user={user} onLogout={handleLogout} />}
        <SyncStatus isOnline={isOnline} />
        
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
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
