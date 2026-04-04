/**
 * IntegrationService
 * Handles connections to external health systems.
 */
class IntegrationService {
  /**
   * Mock implementation of PharmaSync API retrieval.
   * In a real scenario, this would make an HTTP request to an external provider.
   */
  async getExternalMedicationHistory(patientId, externalPatientId) {
    console.log(`[IntegrationService] Fetching medication history from PharmaSync for external ID: ${externalPatientId}`);

    // Simulating external API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock data returned from "PharmaSync"
    const mockExternalData = [
      {
        name: "Amoxicillin",
        dosage: "500mg",
        frequency: "Three times daily",
        prescribedBy: "Dr. Smith (PharmaSync External)",
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Retrieved via PharmaSync Integration"
      },
      {
        name: "Lisinopril",
        dosage: "10mg",
        frequency: "Once daily",
        prescribedBy: "Dr. Jones (PharmaSync External)",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Retrieved via PharmaSync Integration"
      }
    ];

    return mockExternalData;
  }

  /**
   * Identifies external systems available for integration.
   * (HEAL-128)
   */
  async getAvailableIntegrations() {
    return [
      {
        id: 'pharmasync',
        name: 'PharmaSync',
        type: 'Pharmacy',
        description: 'Automatic medication history synchronization.',
        status: 'active'
      },
      {
        id: 'healthconnect',
        name: 'Health Connect',
        type: 'Wearable/Device',
        description: 'Sync steps, sleep, and heart rate data.',
        status: 'planned'
      }
    ];
  }
}

export default new IntegrationService();
