import React, { useState, useEffect } from 'react';
import { MapPin, Loader, AlertCircle } from 'lucide-react';

const GPSLocation = ({ onLocationCapture, disabled }) => {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported by your browser');
      return;
    }

    setLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setLocation(locationData);
        setLoading(false);
        onLocationCapture(locationData);
      },
      (error) => {
        setLoading(false);
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case error.POSITION_UNAVAILABLE:
            setError('Location information unavailable');
            break;
          case error.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Unknown error occurred');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="form-group">
      <label>GPS Location</label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          type="button"
          onClick={captureLocation}
          disabled={loading || disabled}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          {loading ? (
            <>
              <Loader size={16} className="spinning" />
              Capturing...
            </>
          ) : location ? (
            <>
              <MapPin size={16} />
              Update Location
            </>
          ) : (
            <>
              <MapPin size={16} />
              Capture Location
            </>
          )}
        </button>
        
        {location && (
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
          </span>
        )}
      </div>
      
      {error && (
        <div className="alert alert-error" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      
      {location && (
        <div style={{ marginTop: '10px', fontSize: '13px', color: '#64748b' }}>
          <a 
            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#4a9d5f', textDecoration: 'underline' }}
          >
            View on Google Maps
          </a>
        </div>
      )}
    </div>
  );
};

export default GPSLocation;
