import React, { useState, useRef } from 'react';
import { QrCode, Camera, X, CheckCircle } from 'lucide-react';

const BarcodeScanner = ({ onScan, disabled }) => {
  const [scanning, setScanning] = useState(false);
  const [scannedCodes, setScannedCodes] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Start camera for scanning
  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use rear camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setScanning(true);
      }
    } catch (error) {
      alert('Camera access denied or not available. Please use manual input.');
      setShowManualInput(true);
    }
  };

  // Stop camera
  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  // Add scanned code (simulated - in real app would use library like jsQR or QuaggaJS)
  const addScannedCode = (code, type = 'manual') => {
    const newCode = {
      code: code,
      type: type, // 'barcode', 'qr', or 'manual'
      timestamp: new Date().toISOString()
    };
    
    const updatedCodes = [...scannedCodes, newCode];
    setScannedCodes(updatedCodes);
    onScan(updatedCodes);
    setManualInput('');
  };

  // Remove scanned code
  const removeCode = (index) => {
    const updatedCodes = scannedCodes.filter((_, i) => i !== index);
    setScannedCodes(updatedCodes);
    onScan(updatedCodes);
  };

  // Handle manual input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      addScannedCode(manualInput.trim(), 'manual');
    }
  };

  return (
    <div className="form-group">
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <QrCode size={16} />
        Barcode / QR Code Scanner
      </label>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {!scanning && (
          <>
            <button
              type="button"
              onClick={startScanning}
              disabled={disabled}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Camera size={16} />
              Scan Code
            </button>
            
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              disabled={disabled}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <QrCode size={16} />
              {showManualInput ? 'Hide' : 'Manual Entry'}
            </button>
          </>
        )}

        {scanning && (
          <button
            type="button"
            onClick={stopScanning}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <X size={16} />
            Stop Scanning
          </button>
        )}
      </div>

      {/* Camera Preview */}
      {scanning && (
        <div style={{ 
          border: '2px solid #4a9d5f', 
          borderRadius: '8px', 
          overflow: 'hidden',
          marginBottom: '15px',
          position: 'relative'
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200px',
            height: '200px',
            border: '3px solid #4a9d5f',
            borderRadius: '8px',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            Align code within frame (Note: Demo mode - use manual entry)
          </div>
        </div>
      )}

      {/* Manual Input Form */}
      {showManualInput && (
        <form onSubmit={handleManualSubmit} style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter barcode or QR code manually"
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={!manualInput.trim() || disabled}
              className="btn btn-primary"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Scanned Codes List */}
      {scannedCodes.length > 0 && (
        <div style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '10px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            marginBottom: '10px',
            color: '#64748b'
          }}>
            Scanned Codes ({scannedCodes.length})
          </div>
          
          {scannedCodes.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                marginBottom: '8px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 500,
                  fontFamily: 'monospace',
                  marginBottom: '4px'
                }}>
                  {item.code}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  <span style={{ 
                    display: 'inline-block',
                    padding: '2px 6px',
                    backgroundColor: '#e0f2fe',
                    borderRadius: '3px',
                    marginRight: '8px'
                  }}>
                    {item.type.toUpperCase()}
                  </span>
                  {new Date(item.timestamp).toLocaleString()}
                </div>
              </div>
              
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeCode(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ef4444',
                    padding: '4px'
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {scannedCodes.length === 0 && !scanning && !showManualInput && (
        <div style={{ 
          textAlign: 'center', 
          padding: '20px', 
          color: '#94a3b8',
          fontSize: '14px',
          border: '1px dashed #cbd5e1',
          borderRadius: '8px'
        }}>
          No codes scanned yet. Click "Scan Code" or "Manual Entry" to add codes.
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
