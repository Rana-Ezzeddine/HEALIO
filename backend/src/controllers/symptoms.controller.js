import Symptom from '../models/Symptom.js';

export function getUserKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
        return req.user.sub || req.user.id;
    }

    return "demo-user";
}

export async function createSymptom(req, res) {
    try {
        const userId = getUserKey(req);

        const { symptom, severity, date, notes } = req.body;

        if (typeof symptom !== "string" || symptom.trim().length === 0) {
            return res.status(400).json({ message: "symptom is required" });
        }

        const sev = Number(severity);
        if (!Number.isInteger(sev) || sev < 1 || sev > 10) {
            return res.status(400).json({ message: "severity must be an integer between 1 and 10" });
        }

        const symptomDate = typeof date === "string" && date.length > 0
            ? date
            : new Date().toISOString().slice(0, 10);

        const entry = await Symptom.create({
            userId,
            symptom: symptom.trim(),
            severity: sev,
            date: symptomDate,
            notes: typeof notes === "string" ? notes : "",
        });

        return res.status(201).json(entry);
    } catch (error) {
        console.error('Error creating symptom:', error);
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
