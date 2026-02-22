import Symptom from "../models/Symptom.js";

export function getUserKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
        return req.user.sub || req.user.id;
    }
    return null;
}

export async function createSymptom(req, res) {
  try {
    const patientId = getUserKey(req);
    if (!patientId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { symptom, name, severity, date, loggedAt, notes } = req.body;

    const text = String(symptom ?? name ?? "").trim();
    if (!text) {
      return res.status(400).json({ message: "symptom is required" });
    }

    const sev = Number(severity);
    if (!Number.isInteger(sev) || sev < 1 || sev > 10) {
      return res.status(400).json({
        message: "severity must be an integer between 1 and 10",
      });
    }

    const d = String(date ?? loggedAt ?? "").trim();
    const dateOnly = d.length > 0 ? d : new Date().toISOString().slice(0, 10);

    const entry = await Symptom.create({
      patientId,
      name: text,
      severity: sev,
      notes: typeof notes === "string" ? notes : "",
      loggedAt: dateOnly,
    });

    return res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating symptom:", error);
    return res.status(500).json({ message: "Failed to create symptom" });
  }
}

export async function listSymptoms(req, res) {
    try {
        const patientId = getUserKey(req);
        if (!patientId) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const symptoms = await Symptom.findAll({
            where: { patientId },               // ✅ model field
            order: [["loggedAt", "DESC"], ["createdAt", "DESC"]],
        });

        return res.status(200).json(symptoms);
    } catch (error) {
        console.error("Error fetching symptoms:", error);
        return res.status(500).json({ message: "Failed to fetch symptoms" });
    }
}