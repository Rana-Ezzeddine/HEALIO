/**
 * Activity Formatter
 *
 * Transforms technical backend logs into user-friendly product language.
 */
export function formatActivity(log) {
  const { action, method, path, metadata, createdAt } = log;
  
  // Custom mapping for actions
  const ACTION_MAP = {
    'create_appointment': 'Scheduled a new appointment',
    'update_appointment': 'Updated appointment details',
    'cancel_appointment': 'Cancelled an appointment',
    'create_medication': 'Added a new medication',
    'update_medication': 'Updated medication schedule',
    'create_diagnosis': 'Recorded a new diagnosis',
    'create_medical_note': 'Added a medical note',
    'update_caregiver_permission': 'Updated caregiver access permissions',
    'send_message': 'Sent a message',
  };

  if (ACTION_MAP[action]) {
    return ACTION_MAP[action];
  }

  // Fallback heuristic based on method and path
  if (method === 'POST') {
    if (path.includes('/medications')) return 'Added a medication record';
    if (path.includes('/appointments')) return 'Created an appointment entry';
    if (path.includes('/symptoms')) return 'Logged a new symptom';
    if (path.includes('/messages')) return 'Sent a new message';
  }

  if (method === 'PATCH' || method === 'PUT') {
    if (path.includes('/medications')) return 'Modified a medication schedule';
    if (path.includes('/appointments')) return 'Modified an appointment';
    if (path.includes('/profile')) return 'Updated profile information';
  }

  if (method === 'DELETE') {
    return 'Removed a record';
  }

  // Generic fallback
  return `Performed action: ${action || 'General update'}`;
}

export function transformLogs(logs) {
  return logs.map(log => ({
    id: log.id,
    userId: log.userId,
    description: formatActivity(log),
    timestamp: log.createdAt,
    metadata: log.metadata,
  }));
}
