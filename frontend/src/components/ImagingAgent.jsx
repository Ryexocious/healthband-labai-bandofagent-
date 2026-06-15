import React, { useState } from 'react';
import { MIcon } from './Icons';

export default function ImagingAgent({ caseData, user, onRefresh }) {
  const [isUploading, setIsUploading] = useState(false);
  const [scanTypeToOrder, setScanTypeToOrder] = useState('Chest X-ray');
  const [isOrdering, setIsOrdering] = useState(false);
  const [docNotes, setDocNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // DICOM Viewer Simulator Controls
  const [selectedScan, setSelectedScan] = useState(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(false);
  const [showOverlays, setShowOverlays] = useState(false);

  // Parse Case Outputs
  let reviewerOutput = caseData?.reviewer_output;
  if (typeof reviewerOutput === 'string') {
    try { reviewerOutput = JSON.parse(reviewerOutput); } catch(e) {}
  }
  let diagOutput = caseData?.diagnostic_output;
  if (typeof diagOutput === 'string') {
    try { diagOutput = JSON.parse(diagOutput); } catch(e) {}
  }
  let files = caseData?.uploaded_files_info || [];
  if (typeof files === 'string') {
    try { files = JSON.parse(files); } catch(e) { files = []; }
  }

  // Ensure files are structured as objects
  const structuredFiles = files.map(f => {
    if (typeof f === 'string') {
      return { filename: f, type: f.toLowerCase().includes('pdf') ? 'lab_report' : 'xray' };
    }
    return f;
  });

  const imagingNote = reviewerOutput?.imaging_note;
  const analysis = diagOutput?.imaging_analysis;
  const orderedScans = diagOutput?.ordered_scans || [];
  const radiologicalInterpretation = diagOutput?.radiological_interpretation;

  const imagingFiles = structuredFiles.filter(f => 
    f.type === 'xray' || f.type === 'mri' || f.type === 'image' || 
    f.filename.toLowerCase().includes('xray') || f.filename.toLowerCase().includes('mri') || f.filename.toLowerCase().includes('png') || f.filename.toLowerCase().includes('jpg')
  );

  // Set initial selected scan if not set
  if (!selectedScan && (imagingFiles.length > 0 || orderedScans.length > 0)) {
    if (imagingFiles.length > 0) {
      setSelectedScan(imagingFiles[0]);
    } else {
      setSelectedScan({ filename: orderedScans[0], type: 'ordered', mockType: orderedScans[0].toLowerCase().includes('brain') ? 'mri' : 'xray' });
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/imaging/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleOrderScan = async () => {
    setIsOrdering(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/imaging/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scan_type: scanTypeToOrder })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/imaging/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: docNotes })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    setZoom(1);
    setInvert(false);
    setShowOverlays(false);
  };

  // Render simulated DICOM scan based on name/type
  const renderSimulatedScan = (scan) => {
    const isMri = scan.filename?.toLowerCase().includes('mri') || scan.filename?.toLowerCase().includes('brain') || scan.mockType === 'mri';
    
    const filterStyle = {
      filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(1)' : ''}`,
      transform: `scale(${zoom})`,
      transition: 'transform 0.1s ease, filter 0.1s ease',
      maxWidth: '100%',
      maxHeight: '400px',
      objectFit: 'contain'
    };

    if (scan.base64) {
      return (
        <div style={{ position: 'relative', overflow: 'hidden', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '8px' }}>
          <img src={`data:${scan.content_type || 'image/png'};base64,${scan.base64}`} alt={scan.filename} style={filterStyle} />
          {showOverlays && (
            <div style={{ position: 'absolute', top: '20px', left: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '12px', pointerEvents: 'none', background: 'rgba(0,0,0,0.5)', padding: '6px', borderRadius: '4px' }}>
              <div>PATIENT: {caseData.patient_name || 'ANONYMOUS'}</div>
              <div>SCAN: {scan.filename}</div>
              <div>CONTRAST MAPPED</div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', overflow: 'hidden', height: '400px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
        <div style={filterStyle}>
          {isMri ? (
            // Simulated Brain MRI SVG
            <svg width="350" height="350" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#050505" />
              {/* Outer Skull outline */}
              <ellipse cx="50" cy="50" rx="35" ry="42" fill="none" stroke="#6b7280" strokeWidth="2" />
              {/* Inner Skull outline */}
              <ellipse cx="50" cy="50" rx="33" ry="40" fill="none" stroke="#9ca3af" strokeWidth="1" />
              {/* Brain Ventricles */}
              <path d="M45,45 Q40,30 50,25 Q60,30 55,45 Q50,48 45,45 Z" fill="#202020" stroke="#4b5563" strokeWidth="0.5" />
              <path d="M40,55 Q35,70 50,75 Q65,70 60,55 Q50,58 40,55 Z" fill="#202020" stroke="#4b5563" strokeWidth="0.5" />
              {/* Brain Lobes */}
              <ellipse cx="40" cy="45" rx="15" ry="20" fill="#2a2a2a" opacity="0.8" />
              <ellipse cx="60" cy="45" rx="15" ry="20" fill="#2a2a2a" opacity="0.8" />
              <ellipse cx="42" cy="62" rx="14" ry="15" fill="#303030" opacity="0.8" />
              <ellipse cx="58" cy="62" rx="14" ry="15" fill="#303030" opacity="0.8" />
              {/* Brain stem */}
              <path d="M48,82 L46,95 L54,95 L52,82 Z" fill="#404040" />
            </svg>
          ) : (
            // Simulated Chest X-ray SVG
            <svg width="350" height="350" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#050505" />
              {/* Spine */}
              <line x1="50" y1="5" x2="50" y2="95" stroke="#9ca3af" strokeWidth="4" strokeDasharray="3 2" />
              {/* Heart Outline */}
              <ellipse cx="55" cy="52" rx="12" ry="14" fill="#333333" stroke="#9ca3af" strokeWidth="0.5" />
              {/* Left Lung Lobe */}
              <path d="M20,20 Q12,40 18,80 Q35,82 45,75 Q42,50 35,20 Z" fill="#151515" stroke="#4b5563" strokeWidth="1" />
              {/* Right Lung Lobe */}
              <path d="M80,20 Q88,40 82,80 Q65,82 55,75 Q58,50 65,20 Z" fill="#151515" stroke="#4b5563" strokeWidth="1" />
              {/* Ribcage */}
              {[25, 35, 45, 55, 65, 75].map((y, i) => (
                <g key={i}>
                  <path d={`M20,${y} Q30,${y+2} 48,${y}`} fill="none" stroke="#6b7280" strokeWidth="0.75" />
                  <path d={`M80,${y} Q70,${y+2} 52,${y}`} fill="none" stroke="#6b7280" strokeWidth="0.75" />
                </g>
              ))}
              {/* Clavicles */}
              <path d="M15,15 Q30,20 48,22" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
              <path d="M85,15 Q70,20 52,22" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
            </svg>
          )}
        </div>

        {showOverlays && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '20px', left: '20px', color: '#10b981', fontFamily: 'monospace', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '6px', borderRadius: '4px' }}>
              <div>PATIENT: {caseData.patient_name || 'ANONYMOUS'}</div>
              <div>MODE: SIMULATED {isMri ? 'MRI' : 'X-RAY'}</div>
              <div>DATE: {new Date(caseData.created_at).toLocaleDateString()}</div>
            </div>
            
            {/* Draw highlights */}
            {isMri ? (
              <div style={{ position: 'absolute', top: '55%', left: '52%', transform: 'translate(-50%, -50%)' }}>
                <div style={{ width: '40px', height: '40px', border: '2px dashed #ef4444', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', background: 'rgba(0,0,0,0.7)', padding: '2px 4px', borderRadius: '3px', marginTop: '4px', whiteSpace: 'nowrap' }}>
                  Suspicious Signal Focus
                </div>
              </div>
            ) : (
              <div style={{ position: 'absolute', top: '60%', left: '30%', transform: 'translate(-50%, -50%)' }}>
                <div style={{ width: '50px', height: '35px', border: '2px dashed #ef4444', borderRadius: '30%', animation: 'pulse 2s infinite' }} />
                <div style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', background: 'rgba(0,0,0,0.7)', padding: '2px 4px', borderRadius: '3px', marginTop: '4px', whiteSpace: 'nowrap' }}>
                  Interstitial Density
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-title">Imaging Agent Workspace</div>
        <p className="text-gray-500">DICOM simulation, automated radiological pattern recognition, and scan orders.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Side: DICOM Viewer Simulator */}
        <div style={{ background: '#111', color: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MIcon name="tv" /> DICOM SIMULATOR
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setShowOverlays(!showOverlays)} 
                style={{ padding: '4px 10px', fontSize: '12px', background: showOverlays ? '#10b981' : '#222', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Clinical Overlays
              </button>
              <button 
                onClick={resetFilters} 
                style={{ padding: '4px 10px', fontSize: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>

          {selectedScan ? (
            <>
              {renderSimulatedScan(selectedScan)}
              <div style={{ display: 'flex', justifyContent: 'center', fontSize: '13px', color: '#9ca3af' }}>
                Viewing: {selectedScan.filename || selectedScan.mockType?.toUpperCase()}
              </div>
            </>
          ) : (
            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
              <MIcon name="hide_image" style={{ fontSize: '48px', marginBottom: '12px' }} />
              <p>No scans uploaded or ordered for this case yet.</p>
            </div>
          )}

          {/* Slider Controllers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#181818', padding: '12px', borderRadius: '8px', border: '1px solid #282828' }}>
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                <span>Brightness</span> <span>{brightness}%</span>
              </label>
              <input 
                type="range" min="50" max="200" value={brightness} 
                onChange={(e) => setBrightness(Number(e.target.value))} 
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>
            
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                <span>Contrast</span> <span>{contrast}%</span>
              </label>
              <input 
                type="range" min="50" max="200" value={contrast} 
                onChange={(e) => setContrast(Number(e.target.value))} 
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                <span>Digital Zoom</span> <span>{zoom}x</span>
              </label>
              <input 
                type="range" min="1" max="3" step="0.1" value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
                style={{ width: '100%', accentColor: '#10b981' }} 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>Invert Scan Colors</span>
              <button 
                onClick={() => setInvert(!invert)} 
                style={{ padding: '6px 12px', fontSize: '12px', background: invert ? '#10b981' : '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {invert ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Clinical Info & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Diagnostic Agent Pattern Recognition */}
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--hb-primary)' }}>
              <MIcon name="online_prediction" /> AI Radiological Finding
            </h3>
            <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: '1.5', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
              {analysis || 'Awaiting radiological pattern recognition analysis from Diagnostic Agent.'}
            </p>
          </div>

          {/* Upload Scan Panel */}
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <MIcon name="upload_file" /> Upload Scan File
            </h3>
            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '20px', textAlign: 'center', background: '#f9fafb', position: 'relative' }}>
              <input 
                type="file" 
                onChange={handleFileUpload} 
                accept="image/*" 
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} 
                disabled={isUploading}
              />
              <MIcon name={isUploading ? "sync" : "cloud_upload"} style={{ fontSize: '32px', color: '#9ca3af', animation: isUploading ? 'spin 2s linear infinite' : 'none', marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>
                {isUploading ? 'Uploading and running pattern matching...' : 'Drag and drop or click to upload chest X-ray or brain MRI scan'}
              </p>
            </div>
          </div>

          {/* Clinician Scan Ordering Console (DOCTOR ONLY) */}
          {user?.role === 'DOCTOR' && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb' }}>
                <MIcon name="shopping_cart" /> Order Clinical Imaging
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select 
                  value={scanTypeToOrder} 
                  onChange={(e) => setScanTypeToOrder(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="Chest X-ray">Chest X-ray</option>
                  <option value="Brain MRI">Brain MRI</option>
                  <option value="Abdominal CT Scan">Abdominal CT Scan</option>
                  <option value="Spine X-ray">Spine X-ray</option>
                </select>
                <button 
                  onClick={handleOrderScan} 
                  disabled={isOrdering}
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isOrdering ? 'Ordering...' : 'Place Order'}
                </button>
              </div>

              {orderedScans.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Ordered Scans:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {orderedScans.map((scan, idx) => (
                      <span 
                        key={idx} 
                        onClick={() => setSelectedScan({ filename: scan, type: 'ordered', mockType: scan.toLowerCase().includes('brain') ? 'mri' : 'xray' })}
                        style={{ fontSize: '11px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {scan} (Pending)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Imaging Gallery */}
          {imagingFiles.length > 0 && (
            <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#475569' }}>Imaging Gallery</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                {imagingFiles.map((f, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedScan(f)}
                    style={{ border: selectedScan?.filename === f.filename ? '2px solid #10b981' : '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', height: '60px', background: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {f.base64 ? (
                      <img src={`data:${f.content_type || 'image/png'};base64,${f.base64}`} alt={f.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '10px', color: '#fff', textAlign: 'center', padding: '4px' }}>{f.filename.slice(0, 10)}...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Radiologist / Clinical Interpretation Notes */}
          <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563' }}>
              <MIcon name="rate_review" /> Radiological Interpretation Notes
            </h3>
            {user?.role === 'DOCTOR' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <textarea 
                  value={docNotes} 
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="Document findings and specialist review details here..."
                  style={{ width: '100%', minHeight: '80px', padding: '10px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
                <button 
                  onClick={handleSaveNotes} 
                  disabled={isSavingNotes}
                  style={{ alignSelf: 'flex-end', padding: '6px 16px', background: '#4b5563', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  {isSavingNotes ? 'Saving...' : 'Save Interpretation'}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#4b5563', margin: 0, background: '#f9fafb', padding: '10px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
                {radiologicalInterpretation || 'Awaiting specialist radiological review interpretation notes.'}
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
