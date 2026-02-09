import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api';
import { UserPlus, Edit, Trash2, Key, X, Check, XCircle } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'password'
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'inspector',
    isActive: true
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.create(formData);
      alert('User created successfully');
      closeModal();
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await usersAPI.update(selectedUser.id, {
        fullName: formData.fullName,
        role: formData.role,
        isActive: formData.isActive
      });
      alert('User updated successfully');
      closeModal();
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await usersAPI.changePassword(selectedUser.id, newPassword);
      alert('Password changed successfully');
      closeModal();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to change password');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.full_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await usersAPI.delete(user.id);
      alert('User deleted successfully');
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await usersAPI.update(user.id, {
        fullName: user.full_name,
        role: user.role,
        isActive: !user.is_active
      });
      loadUsers();
    } catch (error) {
      alert('Failed to update user status');
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'inspector',
      isActive: true
    });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active
    });
    setShowModal(true);
  };

  const openPasswordModal = (user) => {
    setModalMode('password');
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMode('create');
    setSelectedUser(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      role: 'inspector',
      isActive: true
    });
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>User Management</h1>
        <button onClick={openCreateModal} className="btn btn-primary">
          <UserPlus size={20} /> Add User
        </button>
      </div>

      <div style={{ marginBottom: '20px', color: '#64748b', fontSize: '14px' }}>
        Total Users: {users.length} | Active: {users.filter(u => u.is_active).length} | Inactive: {users.filter(u => !u.is_active).length}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.full_name}</td>
              <td>{user.email}</td>
              <td><span className="badge badge-info">{user.role}</span></td>
              <td>
                <span 
                  className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleToggleActive(user)}
                  title="Click to toggle status"
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEditModal(user)}
                    className="btn btn-icon"
                    title="Edit user"
                    style={{
                      padding: '6px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    onClick={() => openPasswordModal(user)}
                    className="btn btn-icon"
                    title="Change password"
                    style={{
                      padding: '6px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Key size={16} />
                  </button>

                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="btn btn-icon"
                    title="Delete user"
                    style={{
                      padding: '6px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          No users found. Click "Add User" to create your first user.
        </div>
      )}

      {/* Modal for Create/Edit/Password */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>
                {modalMode === 'create' && 'Add New User'}
                {modalMode === 'edit' && 'Edit User'}
                {modalMode === 'password' && 'Change Password'}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#64748b'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Create User Form */}
            {modalMode === 'create' && (
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="form-control"
                    placeholder="John Doe"
                  />
                </div>

                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="form-control"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    className="form-control"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-control"
                  >
                    <option value="inspector">Inspector</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} /> Create User
                  </button>
                </div>
              </form>
            )}

            {/* Edit User Form */}
            {modalMode === 'edit' && (
              <form onSubmit={handleUpdateUser}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="form-control"
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '12px' }}>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-control"
                  >
                    <option value="inspector">Inspector</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Account Active
                  </label>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} /> Update User
                  </button>
                </div>
              </form>
            )}

            {/* Change Password Form */}
            {modalMode === 'password' && (
              <form onSubmit={handleChangePassword}>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#fef3c7', 
                  borderRadius: '6px',
                  marginBottom: '20px',
                  fontSize: '14px',
                  color: '#92400e'
                }}>
                  Changing password for: <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email})
                </div>

                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="form-control"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div className="form-group">
                  <label>Confirm New Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="form-control"
                    placeholder="Re-enter password"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Passwords do not match
                    </small>
                  )}
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={closeModal} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={newPassword !== confirmPassword || newPassword.length < 6}
                  >
                    <Key size={16} /> Change Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
