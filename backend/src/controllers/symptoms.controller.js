import Symptom from '../models/Symptom.js';

export function getUserKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
        return req.user.sub || req.user.id;
    }

    return "demo-user";
}

export async function createSymptom(req, res) {
  try {
    const userKey = getUserKey(req);

    const { symptom, name, severity, date, loggedAt, notes } = req.body;

    const text = String(symptom ?? name ?? "").trim();
    if (!text) {
      return res.status(400).json({ message: "symptom is required" });
    }

    const sev = Number(severity);
    if (!Number.isInteger(sev) || sev < 1 || sev > 10) {
      return res.status(400).json({ message: "severity must be an integer between 1 and 10" });
    }

    const d = String(date ?? loggedAt ?? "").trim();
    const dateOnly = d.length > 0 ? d : new Date().toISOString().slice(0, 10);

    // Build payload that works whether the model uses old or new column names
    const payload = {
      userId: userKey,
      patientId: userKey,
      symptom: text,
      name: text,
      date: dateOnly,
      loggedAt: new Date(dateOnly),
      severity: sev,
      notes: typeof notes === "string" ? notes : "",
    };

    const entry = await Symptom.create(payload);

    return res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating symptom:", error);
    return res.status(500).json({ message: "Failed to create symptom" });
  }
}

export async function listSymptoms(req, res) {
    try {
        const userId = getUserKey(req);

        const symptoms = await Symptom.findAll({
            where: { userId },
            order: [['date', 'DESC'], ['createdAt', 'DESC']]
        });

        return res.status(200).json(symptoms);
    } catch (error) {
        console.error('Error fetching symptoms:', error);
        return res.status(500).json({ message: "Failed to fetch symptoms" });
    }
}
