import { addSymptom, getSymptoms } from "../store/symptoms.store.js";

export function getUserKey(req) {
    if (req.user && (req.user.sub || req.user.id)) {
        return req.user.sub || req.user.id;
    }

    return "demo-user";
}

export function createSymptom(req, res) {
    const userKey = getUserKey(req);

    const { symptom, severity, date, notes } = req.body;

    if (typeof symptom !== "string" || symptom.trim().length === 0) {
        return res.status(400).json({ message: "symptom is required" });
    }

    const sev = Number(severity);
    if (!Number.isInteger(sev) || sev < 1 || sev > 10) {
        return res.status(400).json({ message: "severity must be an integer between 1 and 10" });
    }

    const entry = {
        id: Date.now().toString(),
        symptom: symptom.trim(),
        severity: sev,
        date:
            typeof date === "string" && date.length > 0
                ? date
                : new Date().toISOString().slice(0, 10),
        notes: typeof notes === "string" ? notes : "",
    };

    addSymptom(userKey, entry);
    return res.status(201).json(entry);
}

export function listSymptoms(req, res) {
    const userKey = getUserKey(req);
    return res.status(200).json(getSymptoms(userKey));
}
