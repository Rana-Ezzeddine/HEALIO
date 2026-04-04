function pushEvidence(evidence, code, label, points, detail, severity = "info") {
  evidence.push({
    code,
    label,
    points,
    severity,
    detail,
  });
}

export function calculatePatientUrgency(patient) {
  const evidence = [];
  let score = 0;

  const emergencyStatus = !!patient?.emergencyStatus;
  const symptomsLast7Days = Number(patient?.symptomsLast7Days || 0);
  const activeMedicationCount = Number(patient?.activeMedicationCount || 0);
  const activeDiagnosisCount = Number(patient?.activeDiagnosisCount || 0);
  const latestSymptom = patient?.latestSymptom || null;
  const latestSymptomSeverity = String(latestSymptom?.severity || "").toLowerCase();
  const nextAppointmentAt = patient?.nextAppointmentAt ? new Date(patient.nextAppointmentAt) : null;
  const now = Date.now();

  if (emergencyStatus) {
    score += 45;
    pushEvidence(evidence, "emergency_alert", "Active emergency alert", 45, "Patient has an active emergency flag.", "critical");
  }

  if (latestSymptom) {
    if (["high", "severe", "critical"].includes(latestSymptomSeverity)) {
      score += 18;
      pushEvidence(evidence, "severe_symptom", "Severe recent symptom", 18, `${latestSymptom.name || "Symptom"} was logged with ${latestSymptom.severity} severity.`, "critical");
    } else if (["medium", "moderate"].includes(latestSymptomSeverity)) {
      score += 10;
      pushEvidence(evidence, "moderate_symptom", "Moderate recent symptom", 10, `${latestSymptom.name || "Symptom"} was logged with ${latestSymptom.severity} severity.`, "warning");
    } else {
      score += 4;
      pushEvidence(evidence, "recent_symptom", "Recent symptom recorded", 4, `${latestSymptom.name || "Symptom"} was logged recently.`, "info");
    }

    const loggedAt = latestSymptom?.loggedAt ? new Date(latestSymptom.loggedAt).getTime() : null;
    if (loggedAt) {
      const ageHours = (now - loggedAt) / (1000 * 60 * 60);
      if (ageHours <= 24) {
        score += 10;
        pushEvidence(evidence, "symptom_24h", "Symptom in last 24 hours", 10, "Recent symptom activity may need faster review.", "warning");
      } else if (ageHours <= 72) {
        score += 6;
        pushEvidence(evidence, "symptom_72h", "Symptom in last 72 hours", 6, "Symptoms were logged in the last 3 days.", "info");
      }
    }
  }

  if (symptomsLast7Days >= 5) {
    score += 12;
    pushEvidence(evidence, "recurrent_symptoms_high", "Frequent symptoms this week", 12, `${symptomsLast7Days} symptom events were logged in the last 7 days.`, "warning");
  } else if (symptomsLast7Days >= 3) {
    score += 8;
    pushEvidence(evidence, "recurrent_symptoms_medium", "Multiple symptoms this week", 8, `${symptomsLast7Days} symptom events were logged in the last 7 days.`, "info");
  } else if (symptomsLast7Days >= 1) {
    score += 3;
  }

  if (activeDiagnosisCount >= 4) {
    score += 10;
    pushEvidence(evidence, "high_diagnosis_burden", "High active condition burden", 10, `${activeDiagnosisCount} active diagnoses are currently tracked.`, "warning");
  } else if (activeDiagnosisCount >= 2) {
    score += 6;
    pushEvidence(evidence, "diagnosis_burden", "Multiple active conditions", 6, `${activeDiagnosisCount} active diagnoses are currently tracked.`, "info");
  } else if (activeDiagnosisCount === 1) {
    score += 2;
  }

  if (activeMedicationCount >= 8) {
    score += 8;
    pushEvidence(evidence, "polypharmacy_high", "High medication burden", 8, `${activeMedicationCount} active medications may increase complexity.`, "warning");
  } else if (activeMedicationCount >= 5) {
    score += 5;
    pushEvidence(evidence, "polypharmacy_medium", "Moderate medication burden", 5, `${activeMedicationCount} active medications are being managed.`, "info");
  }

  if (!nextAppointmentAt) {
    score += 12;
    pushEvidence(evidence, "no_followup", "No scheduled follow-up", 12, "There is no scheduled future appointment.", "warning");
  } else {
    const daysUntilAppointment = (nextAppointmentAt.getTime() - now) / (1000 * 60 * 60 * 24);
    if (daysUntilAppointment > 14) {
      score += 6;
      pushEvidence(evidence, "followup_far", "Follow-up is distant", 6, "Next scheduled visit is more than two weeks away.", "info");
    }
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const level =
    normalizedScore >= 70 ? "critical" : normalizedScore >= 35 ? "needs_review" : "stable";
  const recommendedAction =
    level === "critical"
      ? "Review immediately and consider same-day outreach."
      : level === "needs_review"
        ? "Review soon and confirm follow-up plan."
        : "Continue routine monitoring.";

  return {
    score: normalizedScore,
    level,
    reasons: evidence.slice(0, 3).map((item) => item.label),
    recommendedAction,
    modelVersion: "deterministic-v1",
    evidence,
  };
}
