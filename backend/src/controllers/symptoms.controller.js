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

        const { symptom, severity, date, notes } = req.body;

        if (typeof symptom !== "string" || symptom.trim().length === 0) {
            return res.status(400).json({ message: "symptom is required" });
        }

        const sev = Number(severity);
        if (!Number.isInteger(sev) || sev < 0 || sev > 10) {
            return res.status(400).json({ message: "severity must be an integer between 0 and 10" });
        }

        // map 'date' → 'loggedAt'
        const loggedAt =
            typeof date === "string" && date.length > 0
                ? new Date(date)
                : new Date();

        const entry = await Symptom.create({
            patientId,
            name: symptom.trim(),          // ✅ model field
            severity: sev,
            notes: typeof notes === "string" ? notes : "",
            loggedAt,                      // ✅ model field
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