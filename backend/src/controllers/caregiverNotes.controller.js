import CaregiverNote from "../models/CaregiverNote.js";
import CaregiverPatientPermission from "../models/CaregiverPatientPermission.js";
import User from "../models/User.js";

async function ensureCaregiverLinkedToPatient(caregiverId, patientId) {
    const link = await CaregiverPatientPermission.findOne({
        where: { caregiverId, patientId },
    });

    return link;
}

async function ensurePatientExists(patientId) {
    const patient = await User.findByPk(patientId, {
        attributes: ["id", "email", "role"],
    });

    if (!patient || patient.role !== "patient") {
        return null;
    }

    return patient;
}

function cleanNote(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

export async function createCaregiverNote(req, res) {
    try {
        if (req.user?.role !== "caregiver") {
            return res.status(403).json({ message: "Only caregivers can create notes." });
        }

        const caregiverId = req.user.id;
        const { patientId, note } = req.body || {};

        if (!patientId) {
            return res.status(400).json({ message: "patientId is required." });
        }

        const cleanedNote = cleanNote(note);
        if (!cleanedNote) {
            return res.status(400).json({ message: "note is required." });
        }

        const patient = await ensurePatientExists(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        const link = await ensureCaregiverLinkedToPatient(caregiverId, patientId);
        if (!link) {
            return res.status(403).json({
                message: "You can only create notes for patients assigned to you.",
            });
        }

        const created = await CaregiverNote.create({
            patientId,
            caregiverId,
            note: cleanedNote,
        });

        return res.status(201).json({
            message: "Caregiver note created.",
            note: created,
        });
    } catch (err) {
        console.error("create caregiver note error:", err);
        return res.status(500).json({
            message: "Server error.",
            debug: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
}

export async function updateCaregiverNote(req, res) {
    try {
        if (req.user?.role !== "caregiver") {
            return res.status(403).json({ message: "Only caregivers can update notes." });
        }

        const caregiverId = req.user.id;
        const { id } = req.params;
        const cleanedNote = cleanNote(req.body?.note);

        if (!cleanedNote) {
            return res.status(400).json({ message: "note is required." });
        }

        const existing = await CaregiverNote.findOne({
            where: { id, caregiverId },
        });

        if (!existing) {
            return res.status(404).json({ message: "Caregiver note not found." });
        }

        const link = await ensureCaregiverLinkedToPatient(caregiverId, existing.patientId);
        if (!link) {
            return res.status(403).json({
                message: "You no longer have access to update this note.",
            });
        }

        await existing.update({ note: cleanedNote });

        return res.json({
            message: "Caregiver note updated.",
            note: existing,
        });
    } catch (err) {
        console.error("update caregiver note error:", err);
        return res.status(500).json({
            message: "Server error.",
            debug: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
}

export async function getCaregiverNotesForPatient(req, res) {
    try {
        if (req.user?.role !== "caregiver") {
            return res.status(403).json({ message: "Only caregivers can view these notes." });
        }

        const caregiverId = req.user.id;
        const { patientId } = req.params;

        const patient = await ensurePatientExists(patientId);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        const link = await ensureCaregiverLinkedToPatient(caregiverId, patientId);
        if (!link) {
            return res.status(403).json({
                message: "You can only retrieve notes for patients assigned to you.",
            });
        }

        const notes = await CaregiverNote.findAll({
            where: { caregiverId, patientId },
            order: [["updatedAt", "DESC"]],
        });

        return res.json({
            patientId,
            caregiverId,
            count: notes.length,
            notes,
        });
    } catch (err) {
        console.error("get caregiver notes error:", err);
        return res.status(500).json({
            message: "Server error.",
            debug: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
}

export async function getMyCaregiverNotes(req, res) {
    try {
        if (req.user?.role !== "caregiver") {
            return res.status(403).json({ message: "Only caregivers can view these notes." });
        }

        const caregiverId = req.user.id;

        const notes = await CaregiverNote.findAll({
            where: { caregiverId },
            order: [["updatedAt", "DESC"]],
        });

        return res.json({
            caregiverId,
            count: notes.length,
            notes,
        });
    } catch (err) {
        console.error("get my caregiver notes error:", err);
        return res.status(500).json({
            message: "Server error.",
            debug: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
}