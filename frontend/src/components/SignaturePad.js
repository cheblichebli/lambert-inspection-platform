import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Trash2, CheckCircle } from 'lucide-react';

const SignaturePad = ({ onSignatureCapture, disabled, label = "Digital Signature" }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, []);

  const startDrawing = (e) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    context.lineTo(x, y);
    context.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL('image/png');
      onSignatureCapture(signatureData);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSignatureCapture(null);
  };

  return (
    <div className="form-group">
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <PenTool size={16} />
        {label}
      </label>
      
      <div style={{ 
        border: '2px dashed #cbd5e1', 
        borderRadius: '8px', 
        padding: '10px',
        backgroundColor: disabled ? '#f1f5f9' : '#ffffff'
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '150px',
            cursor: disabled ? 'not-allowed' : 'crosshair',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            touchAction: 'none'
          }}
        />
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '10px' 
        }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {hasSignature ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4a9d5f' }}>
                <CheckCircle size={14} />
                Signature captured
              </span>
            ) : (
              'Sign above with mouse or touch'
            )}
          </span>
          
          {hasSignature && (
            <button
              type="button"
              onClick={clearSignature}
              disabled={disabled}
              className="btn btn-secondary"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '5px',
                padding: '6px 12px',
                fontSize: '13px'
              }}
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
