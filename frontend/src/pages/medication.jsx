import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar"
import { Plus, Clock, Pencil, Pill, Trash2, X, Check, Search, AlertCircle } from 'lucide-react';
import { apiUrl, authHeaders } from "../api/http";
import { getMedicationFilterOptions, searchAndFilterMedications } from "../api/search";
import { getNextMedicationDose, formatDoseTime } from "../utils/medicationSchedule";

const API_BASE_URL = apiUrl;

const MedicationManager = () => {
  const navigate = useNavigate();
  const [medications, setMedications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("DESC");
  const [filterOptions, setFilterOptions] = useState({ doctors: [], frequencies: [] });
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    frequency: '',
    prescribedBy: '',
    startDate: '',
    endDate: '',
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
      endDate: '2025-01-15',
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

  useEffect(() => {
    if (!backendAvailable) return undefined;

    const timeoutId = window.setTimeout(() => {
      fetchMedications();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [backendAvailable, searchTerm, doctorFilter, frequencyFilter, statusFilter, sortBy, sortOrder]);

  const checkBackendAndFetchMedications = async () => {
    setError(null);

    try {
      // Check if backend is available
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      console.debug(healthResponse)

      if (healthResponse.ok) {
        setBackendAvailable(true);
        await fetchMedicationFilterOptions();
        await fetchMedications();
      } else {
        throw new Error('Backend health check failed');
      }
    } catch (err) {
      console.warn('Backend not available, using fallback data:', err);
      setBackendAvailable(false);
      setMedications(fallbackMedications);
    }
  };

  const fetchMedicationFilterOptions = async () => {
    try {
      const data = await getMedicationFilterOptions();
      setFilterOptions({
        doctors: data.doctors || [],
        frequencies: data.frequencies || [],
      });
    } catch (err) {
      console.error("Error fetching medication filter options:", err);
      setFilterOptions({ doctors: [], frequencies: [] });
    }
  };

  const fetchMedications = async () => {
    try {
      const data = await searchAndFilterMedications({
        q: searchTerm,
        prescribedBy: doctorFilter,
        frequency: frequencyFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      });

      setMedications(data.medications || []);
      setBackendAvailable(true);
      setError(null);
    } catch (err) {
      if (/session expired|not authenticated|not authorized|verify/i.test(err?.message || "")) {
        setBackendAvailable(true);
        setMedications([]);
        setError("Your session expired. Please log in again.");
        return;
      }
      console.error('Error fetching medications:', err);
      setBackendAvailable(false);
      setMedications(fallbackMedications);
      setError('Using offline data - backend unavailable');
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
        endDate: '',
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
      endDate: '',
      notes: '' 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!authHeaders().Authorization) {
      alert("Your session expired. Please log in again.");
      navigate("/loginPage");
      return;
    }

    try {
      if (editingMed) {
        // Update existing medication
        const response = await fetch(`${API_BASE_URL}/api/medications/${editingMed.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            alert("Your session expired. Please log in again.");
            navigate("/loginPage");
            return;
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error || errData?.message || 'Failed to update medication');
        }

        const updatedMed = await response.json();
        setMedications(medications.map(med => med.id === editingMed.id ? updatedMed : med));
      } else {
        // Create new medication
        const response = await fetch(`${API_BASE_URL}/api/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            alert("Your session expired. Please log in again.");
            navigate("/loginPage");
            return;
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error || errData?.message || 'Failed to create medication');
        }

        await response.json();
      }

      await fetchMedicationFilterOptions();
      await fetchMedications();
      closeModal();
      setBackendAvailable(true);
      setError(null);
    } catch (err) {
      console.error('Error saving medication:', err);
      alert(err?.message || 'Failed to save medication.');
    }
  };

  const deleteMedication = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/medications/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert("Your session expired. Please log in again.");
          navigate("/loginPage");
          return;
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || errData?.message || 'Failed to delete medication');
      }
      await fetchMedicationFilterOptions();
      await fetchMedications();
      setBackendAvailable(true);
      setError(null);
    } catch (err) {
      console.error('Error deleting medication:', err);
      alert(err?.message || 'Failed to delete medication.');
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const filteredMedications = useMemo(() => {
    if (backendAvailable) {
      return medications;
    }

    const normalizedSearch = searchTerm.toLowerCase();
    return medications
      .filter((med) => {
        const matchesSearch =
          !normalizedSearch ||
          med.name.toLowerCase().includes(normalizedSearch) ||
          (med.prescribedBy && med.prescribedBy.toLowerCase().includes(normalizedSearch)) ||
          (med.notes && med.notes.toLowerCase().includes(normalizedSearch));
        const matchesDoctor =
          !doctorFilter || (med.prescribedBy && med.prescribedBy.toLowerCase().includes(doctorFilter.toLowerCase()));
        const matchesFrequency =
          !frequencyFilter || (med.frequency && med.frequency.toLowerCase().includes(frequencyFilter.toLowerCase()));
        const matchesStatus =
          !statusFilter ||
          (statusFilter === "active"
            ? !med.endDate || new Date(med.endDate) >= new Date()
            : med.endDate && new Date(med.endDate) < new Date());

        return matchesSearch && matchesDoctor && matchesFrequency && matchesStatus;
      })
      .sort((left, right) => {
        const leftValue = left[sortBy] || "";
        const rightValue = right[sortBy] || "";
        if (sortOrder === "ASC") return String(leftValue).localeCompare(String(rightValue));
        return String(rightValue).localeCompare(String(leftValue));
      });
  }, [backendAvailable, doctorFilter, frequencyFilter, medications, searchTerm, sortBy, sortOrder, statusFilter]);

  const nextDose = useMemo(() => getNextMedicationDose(medications), [medications]);
  const nextDoseText = nextDose
    ? `${nextDose.medication?.name || "Medication"} - ${formatDoseTime(nextDose.at)}`
    : "No upcoming doses";

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6">
      <Navbar
        onLogin={() => setAuthView("login")}
        onSignup={() => setAuthView("signup")}
      />
      <div className="pt-20 max-w-6xl mx-auto">
        {/* Backend Status Alert */}
        {/* {!backendAvailable && (
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
        )} */}
        

        <div className="bg-sky-50 rounded-2xl shadow-md p-5 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 w-12 h-12 flex items-center justify-center rounded-full">
              <Clock className="text-indigo-600"/>
            </div>
            <div>
              <p className="text-slate-600 text-sm">
                Next Dose
              </p>
              <p className="text-lg text-slate-800 font-semibold">
                {nextDoseText}
              </p>
            </div>
          </div>
          {/* <button
            disabled={!nextDose}
            className="text-white font-medium shadow bg-indigo-500 px-4 py-2 rounded-2xl hover:bg-indigo-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Mark as Taken
          </button> */}
        </div>
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Pill className="text-sky-500" size={24} />
                <h1 className="text-2xl font-bold text-slate-800">Medication Management</h1>
              </div>
              <p className="text-sm text-slate-600 mt-1">
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
              className="inline-flex items-center justify-center gap-2 bg-sky-500 text-white px-4 py-2.5 rounded-2xl shadow-md hover:bg-sky-600 hover:shadow-lg transition font-medium"
            >
              <Plus size={20} />
              Add Medication
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-slate-400" size={20} />
            </div>
            <input
              type="text"
              placeholder="Search medications by name or doctor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
            </div>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Doctors</option>
              {filterOptions.doctors.map((doctor) => (
                <option key={doctor} value={doctor}>{doctor}</option>
              ))}
            </select>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Frequencies</option>
              {filterOptions.frequencies.map((frequency) => (
                <option key={frequency} value={frequency}>{frequency}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="past">Past</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="createdAt">Sort by Added Date</option>
              <option value="name">Sort by Name</option>
              <option value="startDate">Sort by Start Date</option>
              <option value="endDate">Sort by End Date</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="DESC">Newest First</option>
              <option value="ASC">Oldest First</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setDoctorFilter("");
                setFrequencyFilter("");
                setStatusFilter("");
                setSortBy("createdAt");
                setSortOrder("DESC");
              }}
              className="px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
            >
              Reset Filters
            </button>
          </div>
        

        {filteredMedications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-1">
                {searchTerm ? 'No medications found' : 'No medications added'}
              </h3>
              <p className="text-slate-500">
                {searchTerm ? 'Try a different search term' : 'Click "Add Medication" to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full ">
                <thead className="bg-slate-50 ">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Medication Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Dosage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Prescribed By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredMedications.map((med) => (
                    <tr key={med.id} className="hover:bg-slate-50 transition duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{med.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{med.dosage}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{med.frequency}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">{med.prescribedBy || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {med.startDate ? new Date(med.startDate).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {med.endDate ? new Date(med.endDate).toLocaleDateString() : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 max-w-xs truncate" title={med.notes}>
                          {med.notes || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openModal(med)}
                            className="text-sky-600 hover:text-sky-800 transition-colors"
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
            <div className="bg-slate-50 px-6 py-3 ">
              <p className="text-sm text-slate-600">
                Showing {filteredMedications.length} of {medications.length} medication{medications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white">
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingMed ? 'Edit Medication' : 'Add New Medication'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Medication Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="e.g., Aspirin"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Dosage <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="dosage"
                      value={formData.dosage}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="e.g., 100mg"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Frequency <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="e.g., Twice daily"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Prescribed By
                    </label>
                    <input
                      type="text"
                      name="prescribedBy"
                      value={formData.prescribedBy}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="e.g., Dr. Smith"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                      placeholder="Additional instructions or reminders"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium flex items-center justify-center gap-2"
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
