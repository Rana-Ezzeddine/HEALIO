# HEALIO External API Documentation (v1)

This documentation provides details on how external software systems (e.g., pharmacy platforms, wearable device aggregators) can interact with HEALIO.

## Authentication

All external API requests must include a valid `X-API-KEY` header.
- **Header**: `X-API-KEY: <your_api_key>`

> [!IMPORTANT]
> API keys are tied to specific HEALIO users (Doctors or Caregivers). Any actions taken via an API key are subject to the same Role-Based Access Control (RBAC) permissions as the owner's account.

## Endpoints

### 1. Get Patient Medications
Retrieve a list of medications for a specific patient.

- **URL**: `/api/v1/external/patients/:patientId/medications`
- **Method**: `GET`
- **Required Scope**: `medications:read`
- **RBAC**: The API key owner must have permission to view the patient's record.

---

### 2. List Available Integrations
List external systems supported by HEALIO for data synchronization.

- **URL**: `/api/v1/external/integrations`
- **Method**: `GET`
- **RBAC**: Any valid HEALIO API key.

---

### 3. Trigger External Sync
Synchronize medication records from an external system (e.g., PharmaSync) into HEALIO.

- **URL**: `/api/v1/external/patients/:patientId/sync-medications`
- **Method**: `POST`
- **Required Scope**: `medications:write`
- **Body**:
  ```json
  {
    "externalPatientId": "PS-12345",
    "systemId": "pharmasync"
  }
  ```
- **RBAC**: The API key owner must have write permissions for the patient's record.

## Error Codes

| Status | Meaning | Description |
|---|---|---|
| 401 | Unauthorized | Missing or invalid API key. |
| 403 | Forbidden | Missing required scope or insufficient RBAC permission for the patient. |
| 404 | Not Found | Patient or resource not found. |
| 500 | Server Error | Internal processing failure. |

---

> [!TIP]
> For testing, use the mock ID `PS-999` with `pharmasync` to verify the retrieval path.
