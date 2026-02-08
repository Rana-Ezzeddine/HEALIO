import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, Search, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5050';

const MedicationManager = () => {
  const [medications, setMedications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    prescribedBy: '',
    startDate: '',
    notes: ''
  });

  // Fallback static data
  const fallbackMedications = [
    { 
      id: 1, 
      name: 'Aspirin', 
      dosage: '100mg', 
      frequency: 'Once daily', 
      prescribedBy: 'Dr. Smith',
      startDate: '2024-01-15',
      notes: 'Take with food' 
    },
    { 
      id: 2, 
      name: 'Lisinopril', 
      dosage: '10mg', 
      frequency: 'Twice daily', 
      prescribedBy: 'Dr. Johnson',
      startDate: '2024-02-20',
      notes: 'Morning and evening' 
    },
    { 
      id: 3, 
      name: 'Metformin', 
      dosage: '500mg', 
      frequency: 'Three times daily', 
      prescribedBy: 'Dr. Smith',
      startDate: '2023-12-10',
      notes: 'With meals' 
    },
  ];

  // Check backend health and fetch medications
  useEffect(() => {
    checkBackendAndFetchMedications();
  }, []);

  const checkBackendAndFetchMedications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if backend is available
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      console.debug(healthResponse)

      if (healthResponse.ok) {
        console.debug("OK")
        setBackendAvailable(true);
        await fetchMedications();
      } else {
        throw new Error('Backend health check failed');
      }
    } catch (err) {
      console.warn('Backend not available, using fallback data:', err);
      setBackendAvailable(false);
      setMedications(fallbackMedications);
      setIsLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/medications`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMedications(data);
      setBackendAvailable(true);
    } catch (err) {
      console.error('Error fetching medications:', err);
      setBackendAvailable(false);
      setMedications(fallbackMedications);
      setError('Using offline data - backend unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (medication = null) => {
    if (medication) {
      setEditingMed(medication);
      setFormData(medication);
    } else {
      setEditingMed(null);
      setFormData({ 
        name: '', 
        dosage: '', 
        frequency: '', 
        prescribedBy: '',
        startDate: '',
        notes: '' 
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMed(null);
    setFormData({ 
      name: '', 
      dosage: '', 
      frequency: '', 
      prescribedBy: '',
      startDate: '',
      notes: '' 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!backendAvailable) {
      alert('Backend unavailable. Changes will not be saved.');
      // Still update local state for demo purposes
      if (editingMed) {
        setMedications(medications.map(med => 
          med.id === editingMed.id ? { ...formData, id: med.id } : med
        ));
      } else {
        const newMed = {
          ...formData,
          id: Math.max(0, ...medications.map(m => m.id)) + 1
        };
        setMedications([...medications, newMed]);
      }
      closeModal();
      return;
    }

    try {
      if (editingMed) {
        // Update existing medication
        const response = await fetch(`${API_BASE_URL}/api/medications/${editingMed.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to update medication');
        }

        const updatedMed = await response.json();
        setMedications(medications.map(med => 
          med.id === editingMed.id ? updatedMed : med
        ));
      } else {
        // Create new medication
        const response = await fetch(`${API_BASE_URL}/api/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          throw new Error('Failed to create medication');
        }

        const newMed = await response.json();
        setMedications([...medications, newMed]);
      }

      closeModal();
    } catch (err) {
      console.error('Error saving medication:', err);
      alert('Failed to save medication. Please try again.');
    }
  };

  const deleteMedication = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    if (!backendAvailable) {
      alert('Backend unavailable. Changes will not be saved.');
      setMedications(medications.filter(med => med.id !== id));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to delete medication');
      }

      setMedications(medications.filter(med => med.id !== id));
    } catch (err) {
      console.error('Error deleting medication:', err);
      alert('Failed to delete medication. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const filteredMedications = medications.filter(med =>
    med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (med.prescribedBy && med.prescribedBy.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Backend Status Alert */}
        {!backendAvailable && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="text-yellow-600 mr-3" size={24} />
              <div>
                <p className="font-medium text-yellow-800">Offline Mode</p>
                <p className="text-sm text-yellow-700">
                  Backend is unavailable. Displaying sample data. Changes will not be saved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Medication Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                Track and manage your prescriptions
                {backendAvailable && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Connected
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus size={20} />
              Add Medication
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={20} />
            </div>
            <input
              type="text"
              placeholder="Search medications by name or doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredMedications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                {searchTerm ? 'No medications found' : 'No medications added'}
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Try a different search term' : 'Click "Add Medication" to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medication Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dosage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prescribed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMedications.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{med.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{med.dosage}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{med.frequency}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{med.prescribedBy || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {med.startDate ? new Date(med.startDate).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 max-w-xs truncate" title={med.notes}>
                          {med.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openModal(med)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => deleteMedication(med.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Footer */}
          {filteredMedications.length > 0 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {filteredMedications.length} of {medications.length} medication{medications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingMed ? 'Edit Medication' : 'Add New Medication'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Medication Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Aspirin"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Dosage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="dosage"
                      value={formData.dosage}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 100mg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Frequency <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Twice daily"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Prescribed By
                    </label>
                    <input
                      type="text"
                      name="prescribedBy"
                      value={formData.prescribedBy}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Dr. Smith"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Additional instructions or reminders"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    {editingMed ? 'Update Medication' : 'Add Medication'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicationManager;