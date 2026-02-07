import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { inspectionsAPI } from '../api';
import { Plus, Filter, Search } from 'lucide-react';

const InspectionList = ({ user }) => {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInspections();
  }, [statusFilter]);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const filters = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await inspectionsAPI.getAll(filters);
      setInspections(data);
    } catch (error) {
      console.error('Error loading inspections:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInspections = inspections.filter(inspection =>
    searchTerm === '' ||
    inspection.template_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inspection.equipment_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inspections</h1>
        {user.role === 'inspector' && (
          <Link to="/inspections/new" className="btn btn-primary">
            <Plus size={20} /> New Inspection
          </Link>
        )}
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search inspections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : filteredInspections.length === 0 ? (
        <div className="empty-state">
          <p>No inspections found</p>
        </div>
      ) : (
        <div className="inspections-grid">
          {filteredInspections.map(inspection => (
            <Link
              key={inspection.id}
              to={`/inspections/${inspection.id}`}
              className="inspection-card"
            >
              <div className="inspection-header">
                <h3>{inspection.template_title}</h3>
                <span className={`badge badge-${inspection.status}`}>
                  {inspection.status}
                </span>
              </div>
              <p>{inspection.location}</p>
              <p className="text-muted">
                {new Date(inspection.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default InspectionList;
