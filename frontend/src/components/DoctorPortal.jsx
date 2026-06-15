import React, { useState, useEffect } from 'react';
import { MIcon } from './Icons';

export default function DoctorPortal({ onCaseSelect }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch('http://localhost:8000/api/cases', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCases(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><MIcon name="sync" className="animate-spin mr-2" /> Loading pending cases...</div>;

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-title">Doctor Portal</div>
        <p className="text-gray-500">Review pending cases from the Clinical Intelligence System.</p>
      </div>

      <div className="mt-6 space-y-4">
        {cases.length === 0 ? (
          <div className="band-empty">
            <div className="band-empty-icon"><MIcon name="check_circle" /></div>
            <p>No pending cases right now. You're all caught up!</p>
          </div>
        ) : (
          cases.map(c => (
            <div key={c.case_id} className="portal-case-card">
              <div className="portal-case-info">
                <h3>Case ID: {c.case_id}</h3>
                <p>Patient: {c.patient_name} • Status: <span className="status-highlight">{c.status}</span></p>
                <p className="date-hint">Submitted: {new Date(c.created_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => onCaseSelect(c.case_id)}
                className="btn-outline"
              >
                Review Case
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
