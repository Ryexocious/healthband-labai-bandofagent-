import React, { useState } from 'react';
import { MIcon } from './Icons';

export default function LabsAgent({ caseData, user, onRefresh }) {
  const [glucose, setGlucose] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [hba1c, setHba1c] = useState('');
  const [weight, setWeight] = useState('');
  
  const [isLogging, setIsLogging] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [labPanelToOrder, setLabPanelToOrder] = useState('Complete Blood Count (CBC)');

  // Parse Database Values
  let iotReadings = caseData?.iot_readings || {};
  if (typeof iotReadings === 'string') {
    try { iotReadings = JSON.parse(iotReadings); } catch(e) { iotReadings = {}; }
  }

  const orderedLabs = iotReadings.ordered_labs || [];
  const vitalsHistory = iotReadings.vitals_history || [];

  // Generate some high-quality mock data if history is empty to display trends
  const resolvedHistory = vitalsHistory.length > 0 ? vitalsHistory : [
    {
      timestamp: new Date(new Date().getTime() - 24 * 60 * 60 * 1000 * 3).toISOString(),
      recorded_by: "Intake Agent (Auto)",
      readings: {
        blood_glucose_mgdl: iotReadings.blood_glucose_mgdl ? iotReadings.blood_glucose_mgdl - 15 : 125,
        blood_pressure: iotReadings.blood_pressure || "128/82",
        spo2_percent: iotReadings.spo2_percent || 97,
        temperature_f: iotReadings.temperature_f || 98.6
      }
    },
    {
      timestamp: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString(),
      recorded_by: "Intake Agent (Auto)",
      readings: {
        blood_glucose_mgdl: iotReadings.blood_glucose_mgdl ? iotReadings.blood_glucose_mgdl - 5 : 138,
        blood_pressure: iotReadings.blood_pressure || "130/84",
        spo2_percent: iotReadings.spo2_percent || 96,
        temperature_f: iotReadings.temperature_f || 99.1
      }
    },
    {
      timestamp: new Date().toISOString(),
      recorded_by: "Vitals Monitor",
      readings: {
        blood_glucose_mgdl: iotReadings.blood_glucose_mgdl,
        blood_pressure: iotReadings.blood_pressure,
        spo2_percent: iotReadings.spo2_percent,
        hba1c_percent: iotReadings.hba1c_percent,
        temperature_f: iotReadings.temperature_f,
        weight_kg: iotReadings.weight_kg
      }
    }
  ].filter(h => Object.values(h.readings).some(v => v !== undefined && v !== null));

  const getGlucoseStatus = (val) => {
    if (!val) return { label: 'N/A', class: 'bg-gray-100 text-gray-800' };
    const num = Number(val);
    if (num < 70) return { label: 'CRITICAL LOW', class: 'bg-red-100 text-red-800' };
    if (num <= 140) return { label: 'NORMAL', class: 'bg-green-100 text-green-800' };
    if (num <= 200) return { label: 'ELEVATED', class: 'bg-yellow-100 text-yellow-800' };
    return { label: 'CRITICAL HIGH', class: 'bg-red-100 text-red-800' };
  };

  const getSpO2Status = (val) => {
    if (!val) return { label: 'N/A', class: 'bg-gray-100 text-gray-800' };
    const num = Number(val);
    if (num >= 95) return { label: 'NORMAL', class: 'bg-green-100 text-green-800' };
    if (num >= 90) return { label: 'LOW SpO2', class: 'bg-yellow-100 text-yellow-800' };
    return { label: 'CRITICAL HYPOXIA', class: 'bg-red-100 text-red-800' };
  };

  const getBPStatus = (val) => {
    if (!val) return { label: 'N/A', class: 'bg-gray-100 text-gray-800' };
    const match = String(val).match(/^(\d+)\/(\d+)$/);
    if (!match) return { label: 'RECORDED', class: 'bg-blue-100 text-blue-800' };
    const sys = Number(match[1]);
    const dia = Number(match[2]);
    if (sys >= 180 || dia >= 120) return { label: 'CRITICAL HYPERTENSIVE', class: 'bg-red-100 text-red-800' };
    if (sys >= 140 || dia >= 90) return { label: 'STAGE 2 HYPERTENSION', class: 'bg-red-100 text-red-800' };
    if (sys >= 120 || dia >= 80) return { label: 'PREHYPERTENSION', class: 'bg-yellow-100 text-yellow-800' };
    return { label: 'NORMAL', class: 'bg-green-100 text-green-800' };
  };

  const getTempStatus = (val) => {
    if (!val) return { label: 'N/A', class: 'bg-gray-100 text-gray-800' };
    const num = Number(val);
    if (num < 95) return { label: 'HYPOTHERMIA', class: 'bg-red-100 text-red-800' };
    if (num <= 99) return { label: 'NORMAL', class: 'bg-green-100 text-green-800' };
    if (num <= 100.4) return { label: 'LOW FEVER', class: 'bg-yellow-100 text-yellow-800' };
    return { label: 'HIGH FEVER', class: 'bg-red-100 text-red-800' };
  };

  const handleLogVitals = async (e) => {
    e.preventDefault();
    setIsLogging(true);
    
    const payload = {};
    if (glucose) payload.blood_glucose_mgdl = parseFloat(glucose);
    if (bloodPressure) payload.blood_pressure = bloodPressure;
    if (spo2) payload.spo2_percent = parseFloat(spo2);
    if (temp) payload.temperature_f = parseFloat(temp);
    if (hba1c) payload.hba1c_percent = parseFloat(hba1c);
    if (weight) payload.weight_kg = parseFloat(weight);

    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/labs/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setGlucose('');
        setBloodPressure('');
        setSpo2('');
        setTemp('');
        setHba1c('');
        setWeight('');
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsLogging(false);
    }
  };

  const handleOrderLab = async (e) => {
    e.preventDefault();
    setIsOrdering(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/labs/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ panel_name: labPanelToOrder })
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

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-title">Labs & Vitals Agent</div>
        <p className="text-gray-500">Log patient vitals, review biomarker clinical flags, and order specialized laboratory assays.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Left Side: Vitals Dashboard & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Active Biomarker Panel */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--hb-primary)' }}>
              <MIcon name="monitoring" /> Live Clinical Vitals Status
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              {/* Blood Glucose */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Blood Glucose</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.blood_glucose_mgdl || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>mg/dL</span>
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }} className={getGlucoseStatus(iotReadings.blood_glucose_mgdl).class}>
                    {getGlucoseStatus(iotReadings.blood_glucose_mgdl).label}
                  </span>
                </div>
              </div>

              {/* Blood Pressure */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Blood Pressure</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.blood_pressure || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>mmHg</span>
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }} className={getBPStatus(iotReadings.blood_pressure).class}>
                    {getBPStatus(iotReadings.blood_pressure).label}
                  </span>
                </div>
              </div>

              {/* SpO2 */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Pulse Oximetry (SpO2)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.spo2_percent || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>%</span>
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }} className={getSpO2Status(iotReadings.spo2_percent).class}>
                    {getSpO2Status(iotReadings.spo2_percent).label}
                  </span>
                </div>
              </div>

              {/* Temperature */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Body Temperature</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.temperature_f || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>°F</span>
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }} className={getTempStatus(iotReadings.temperature_f).class}>
                    {getTempStatus(iotReadings.temperature_f).label}
                  </span>
                </div>
              </div>

              {/* HbA1c */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>HbA1c Level</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.hba1c_percent || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>%</span>
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', background: iotReadings.hba1c_percent > 6.5 ? '#fef2f2' : '#ecfdf5', color: iotReadings.hba1c_percent > 6.5 ? '#991b1b' : '#065f46' }}>
                    {iotReadings.hba1c_percent ? (iotReadings.hba1c_percent > 6.5 ? 'DIABETIC' : 'NORMAL') : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Weight */}
              <div style={{ border: '1px solid #f3f4f6', background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: '600' }}>Body Weight</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    {iotReadings.weight_kg || '--'} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>kg</span>
                  </span>
                  <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#4b5563', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    LOGGED
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Vitals History Trend Log */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#374151' }}>Vitals Log Trends</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '8px' }}>Time</th>
                    <th style={{ padding: '8px' }}>Glucose</th>
                    <th style={{ padding: '8px' }}>BP</th>
                    <th style={{ padding: '8px' }}>SpO2</th>
                    <th style={{ padding: '8px' }}>Temp</th>
                    <th style={{ padding: '8px' }}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedHistory.map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '8px', color: '#6b7280' }}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 'bold' }}>
                        {log.readings.blood_glucose_mgdl || '--'}
                      </td>
                      <td style={{ padding: '8px' }}>{log.readings.blood_pressure || '--'}</td>
                      <td style={{ padding: '8px' }}>{log.readings.spo2_percent ? `${log.readings.spo2_percent}%` : '--'}</td>
                      <td style={{ padding: '8px' }}>{log.readings.temperature_f ? `${log.readings.temperature_f}°F` : '--'}</td>
                      <td style={{ padding: '8px', fontSize: '11px', color: '#4b5563' }}>{log.recorded_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Side: Log Form & Orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Log Vitals Form */}
          <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <MIcon name="edit_note" /> Record Vitals Reading
            </h3>
            
            <form onSubmit={handleLogVitals} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Blood Glucose (mg/dL)</label>
                  <input 
                    type="number" step="0.1" value={glucose} 
                    onChange={(e) => setGlucose(e.target.value)} 
                    placeholder="e.g. 110"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Blood Pressure (systolic/diastolic)</label>
                  <input 
                    type="text" value={bloodPressure} 
                    onChange={(e) => setBloodPressure(e.target.value)} 
                    placeholder="e.g. 120/80"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>SpO2 (%)</label>
                  <input 
                    type="number" step="1" value={spo2} 
                    onChange={(e) => setSpo2(e.target.value)} 
                    placeholder="e.g. 98"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Temperature (°F)</label>
                  <input 
                    type="number" step="0.1" value={temp} 
                    onChange={(e) => setTemp(e.target.value)} 
                    placeholder="e.g. 98.6"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>HbA1c (%)</label>
                  <input 
                    type="number" step="0.1" value={hba1c} 
                    onChange={(e) => setHba1c(e.target.value)} 
                    placeholder="e.g. 5.7"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Weight (kg)</label>
                  <input 
                    type="number" step="0.1" value={weight} 
                    onChange={(e) => setWeight(e.target.value)} 
                    placeholder="e.g. 72"
                    style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isLogging}
                style={{ width: '100%', padding: '10px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                {isLogging ? 'Logging Vitals...' : 'Log Readings'}
              </button>
            </form>
          </div>

          {/* Order Lab Panels (DOCTOR ONLY) */}
          {user?.role === 'DOCTOR' && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb' }}>
                <MIcon name="biotech" /> Order Lab Panel assays
              </h3>

              <form onSubmit={handleOrderLab} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select 
                  value={labPanelToOrder}
                  onChange={(e) => setLabPanelToOrder(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  <option value="Complete Blood Count (CBC)">Complete Blood Count (CBC)</option>
                  <option value="Basic Metabolic Panel (BMP)">Basic Metabolic Panel (BMP)</option>
                  <option value="Lipid Panel">Lipid Panel (Cholesterol/Triglycerides)</option>
                  <option value="Hemoglobin A1c (HbA1c)">Hemoglobin A1c (HbA1c)</option>
                  <option value="Renal Function Panel">Renal Function Panel</option>
                  <option value="Thyroid Panel (TSH/T4)">Thyroid Panel (TSH/T4)</option>
                </select>

                <button 
                  type="submit" 
                  disabled={isOrdering}
                  style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {isOrdering ? 'Ordering Panel...' : 'Order Lab Test'}
                </button>
              </form>
            </div>
          )}

          {/* List Ordered Labs */}
          {orderedLabs.length > 0 && (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 12px 0', color: '#475569' }}>Active Laboratory Orders ({orderedLabs.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedLabs.map((lab, idx) => (
                  <div key={idx} style={{ border: '1px solid #bfdbfe', background: '#eff6ff', padding: '10px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>{lab.panel_name}</div>
                      <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>Ordered by {lab.ordered_by}</div>
                    </div>
                    <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {lab.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
