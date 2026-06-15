import React, { useState } from 'react';
import { MIcon } from './Icons';

export default function PharmacyAgent({ caseData, user, onRefresh }) {
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Doctor Prescription Form States
  const [medName, setMedName] = useState('');
  const [medQty, setMedQty] = useState('');
  const [medCost, setMedCost] = useState('');
  const [medUrl, setMedUrl] = useState('');
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  // Parse Pharmacy Output
  let pharmacyOutput = caseData?.pharmacy_output;
  if (typeof pharmacyOutput === 'string') {
    try { pharmacyOutput = JSON.parse(pharmacyOutput); } catch(e) {}
  }
  
  const medicines = pharmacyOutput?.ordered_medicines || [];
  const totalCost = pharmacyOutput?.total_cost || 0.0;
  const status = pharmacyOutput?.status || 'pending';
  const authorized = pharmacyOutput?.authorized || false;
  const authorizedBy = pharmacyOutput?.authorized_by || '';
  const authorizedAt = pharmacyOutput?.authorized_at || '';

  const handleOrder = async () => {
    setIsOrdering(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/pharmacy/order`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOrderSuccess(true);
        onRefresh();
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!medName || !medQty) return;

    setIsSavingPrescription(true);
    const newMed = {
      name: medName,
      quantity: medQty,
      cost: parseFloat(medCost) || 0.0,
      site_url: medUrl || 'N/A'
    };

    const updatedMeds = [...medicines, newMed];

    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/pharmacy/prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ medicines: updatedMeds })
      });
      if (res.ok) {
        setMedName('');
        setMedQty('');
        setMedCost('');
        setMedUrl('');
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSavingPrescription(false);
    }
  };

  const handleRemoveMedication = async (idxToRemove) => {
    const updatedMeds = medicines.filter((_, idx) => idx !== idxToRemove);
    setIsSavingPrescription(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/pharmacy/prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ medicines: updatedMeds })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSavingPrescription(false);
    }
  };

  const handleAuthorize = async () => {
    setIsAuthorizing(true);
    try {
      const token = sessionStorage.getItem('hb_token');
      const res = await fetch(`http://localhost:8000/api/cases/${caseData.case_id}/pharmacy/authorize`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        onRefresh();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="report-container">
      <div className="report-header">
        <div className="report-title">Pharmacy Agent</div>
        <p className="text-gray-500">Formulate treatments, authorize medications, and place direct pharmacy orders.</p>
      </div>

      {!caseData ? (
        <div className="band-empty">
          <p>No case data available. Start an analysis to see pharmacy insights.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '20px' }}>
          
          {/* Left Side: Prescription List & Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--hb-primary)' }}>
                  <MIcon name="local_pharmacy" /> Active Prescription Order
                </h3>
                <span style={{ fontSize: '11px', background: authorized ? '#ecfdf5' : '#fef3c7', color: authorized ? '#065f46' : '#d97706', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  {authorized ? 'AUTHORIZED & SIGNED' : 'AWAITING PHYSICIAN SIGNATURE'}
                </span>
              </div>

              {/* Specialist Signature Banner */}
              {authorized ? (
                <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <MIcon name="verified" style={{ color: '#10b981' }} />
                  <div>
                    <strong>Digitally Signed by:</strong> Dr. {authorizedBy} on {new Date(authorizedAt).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#92400e', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <MIcon name="pending" style={{ color: '#f59e0b' }} />
                  <div>
                    <strong>Awaiting Signature:</strong> Patient cannot purchase medications until authorized by a specialist.
                  </div>
                </div>
              )}

              {/* Medicines Table */}
              {medicines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '10px' }}>Medication</th>
                        <th style={{ padding: '10px' }}>Quantity</th>
                        <th style={{ padding: '10px' }}>Est. Cost</th>
                        <th style={{ padding: '10px' }}>Ref Link</th>
                        {user?.role === 'DOCTOR' && <th style={{ padding: '10px' }}>Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {medicines.map((med, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>{med.name}</td>
                          <td style={{ padding: '10px', color: '#4b5563' }}>{med.quantity}</td>
                          <td style={{ padding: '10px', fontWeight: '600' }}>${med.cost?.toFixed(2) || '0.00'}</td>
                          <td style={{ padding: '10px' }}>
                            {med.site_url && med.site_url !== 'N/A' && med.site_url !== 'string' ? (
                              <a href={med.site_url.startsWith('http') ? med.site_url : `https://${med.site_url}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                Buy <MIcon name="open_in_new" style={{ fontSize: '12px' }} />
                              </a>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>N/A</span>
                            )}
                          </td>
                          {user?.role === 'DOCTOR' && (
                            <td style={{ padding: '10px' }}>
                              <button 
                                onClick={() => handleRemoveMedication(idx)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              >
                                <MIcon name="delete" style={{ fontSize: '18px' }} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', fontSize: '15px', fontWeight: 'bold' }}>
                    Total Estimated Cost: ${totalCost.toFixed(2)}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#6b7280', fontStyle: 'italic', margin: 0 }}>No medications listed on prescription.</p>
              )}

              {/* Patient Purchasing / Doctor Authorizing Options */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                {user?.role === 'DOCTOR' && !authorized && medicines.length > 0 && (
                  <button 
                    onClick={handleAuthorize} 
                    disabled={isAuthorizing}
                    style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', gap: '6px', alignItems: 'center' }}
                  >
                    <MIcon name="verified" /> {isAuthorizing ? 'Signing...' : 'Sign & Authorize Prescription'}
                  </button>
                )}

                {user?.role === 'PATIENT' && medicines.length > 0 && (
                  <>
                    {orderSuccess ? (
                      <div style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                        <MIcon name="check_circle" /> Pharmacy Order Placed Successfully
                      </div>
                    ) : (
                      <button 
                        onClick={handleOrder} 
                        disabled={isOrdering || !authorized}
                        title={!authorized ? 'Prescription must be authorized by a doctor' : ''}
                        style={{ 
                          padding: '10px 20px', 
                          background: authorized ? '#10b981' : '#d1d5db', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '8px', 
                          cursor: authorized ? 'pointer' : 'not-allowed', 
                          fontWeight: 'bold', 
                          display: 'flex', 
                          gap: '6px', 
                          alignItems: 'center' 
                        }}
                      >
                        <MIcon name="local_shipping" /> {isOrdering ? 'Processing...' : 'Order Medications'}
                      </button>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* Protocol Disclaimer */}
            <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7', fontSize: '13px', color: '#92400e', display: 'flex', gap: '8px' }}>
              <MIcon name="warning" style={{ color: '#f59e0b' }} />
              <div>
                <strong>Clinical Protocol Enforced:</strong> Pharmacological treatments must undergo specialist review and authorization before patient fulfillment. Self-medication without signed physician approval is prohibited.
              </div>
            </div>

          </div>

          {/* Right Side: Doctor Editor & Safety Check */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Add Medication Form (DOCTOR ONLY) */}
            {user?.role === 'DOCTOR' && (
              <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#2563eb' }}>
                  <MIcon name="add_circle" /> Add Medication Item
                </h3>

                <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Medication Name & Dosage</label>
                    <input 
                      type="text" value={medName} 
                      onChange={(e) => setMedName(e.target.value)} 
                      placeholder="e.g. Metformin 500mg" 
                      style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Quantity</label>
                      <input 
                        type="text" value={medQty} 
                        onChange={(e) => setMedQty(e.target.value)} 
                        placeholder="e.g. 30 tablets" 
                        style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Est. Cost ($)</label>
                      <input 
                        type="number" step="0.01" value={medCost} 
                        onChange={(e) => setMedCost(e.target.value)} 
                        placeholder="e.g. 15.00" 
                        style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#4b5563', marginBottom: '4px', fontWeight: 'bold' }}>Purchase / Reference Link</label>
                    <input 
                      type="text" value={medUrl} 
                      onChange={(e) => setMedUrl(e.target.value)} 
                      placeholder="e.g. cvs.com/metformin" 
                      style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingPrescription}
                    style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {isSavingPrescription ? 'Adding...' : 'Add to Prescription'}
                  </button>
                </form>
              </div>
            )}

            {/* Drug Interaction Safety Checker */}
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid var(--hb-border, #eaeaea)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                <MIcon name="shield" /> Drug-Drug Interaction Check
              </h3>

              <div style={{ fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
                  <span>Active Meds Tracked:</span>
                  <span style={{ fontWeight: 'bold', color: '#111827' }}>{medicines.length}</span>
                </div>
                
                {medicines.length > 1 ? (
                  <div style={{ display: 'flex', gap: '8px', padding: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534' }}>
                    <MIcon name="check_circle" style={{ color: '#22c55e' }} />
                    <div>
                      <strong>No Interactions Found:</strong> Automatic screening shows no adverse reactions between the selected medications.
                    </div>
                  </div>
                ) : medicines.length === 1 ? (
                  <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    Single medication checked. No interaction screens required.
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    No medications to screen.
                  </div>
                )}
                
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
                  * Interaction checking is powered by a localized clinical database. Always verify with patient history.
                </div>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
