import { Op } from "sequelize";
import User from "../models/User.js";
import PatientProfile from "../models/PatientProfile.js";
import Medication from "../models/Medication.js";
import Symptom from "../models/Symptom.js";
import Appointment from "../models/Appointment.js";
import CaregiverPatientPermission from "../models/CaregiverPatientPermission.js";
import DoctorPatientAssignment from "../models/DoctorPatientAssignment.js";
import CaregiverNote from '../models/CaregiverNote.js';
import { buildDoctorAvailability, ensureAppointmentSchemaReady } from "./appointments.controller.js";

async function getPatientDisplayProfiles(patientIds) {
  if (!patientIds.length) return new Map();
  const profiles = await PatientProfile.findAll({
    where: { userId: patientIds },
    attributes: ["userId", "firstName", "lastName", "phoneNumber"],
  });
  return new Map(profiles.map((p) => [p.userId, p]));
}

const PERMISSION_KEYS = [
  "canViewMedications",
  "canViewSymptoms",
  "canViewAppointments",
  "canMessageDoctor",
  "canReceiveReminders",
];

function normalizePermissionPayload(payload = {}) {
  const out = {};
  for (const key of PERMISSION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      out[key] = Boolean(payload[key]);
    }
  }
  return out;
}

async function resolveCaregiver({ caregiverId, caregiverEmail }) {
  if (!caregiverId && !caregiverEmail) return null;

  if (caregiverId) {
    return User.findByPk(caregiverId, { attributes: ["id", "email", "role"] });
  }

  return User.findOne({
    where: { email: String(caregiverEmail).toLowerCase().trim() },
    attributes: ["id", "email", "role"],
  });
}

async function getCaregiverPermission(caregiverId, patientId) {
  return CaregiverPatientPermission.findOne({
    where: { caregiverId, patientId, status: "active" },
  });
}

async function requireCaregiverPermissionOrThrow(caregiverId, patientId, permissionKey) {
  const link = await getCaregiverPermission(caregiverId, patientId);
  if (!link || !link[permissionKey]) return null;
  return link;
}

export async function assignCaregiver(req, res) {
  try {
    if (req.user?.role !== "patient") {
      return res.status(403).json({ message: "Only patients can request caregivers." });
    }

    const patientId = req.user.id;
    const { caregiverId, caregiverEmail, permissions = {} } = req.body || {};

    const caregiver = await resolveCaregiver({ caregiverId, caregiverEmail });
    if (!caregiver || caregiver.role !== "caregiver") {
      return res.status(400).json({ message: "Caregiver not found or user is not a caregiver." });
    }

    const permissionData = normalizePermissionPayload(permissions);
    const [link, created] = await CaregiverPatientPermission.findOrCreate({
      where: { caregiverId: caregiver.id, patientId },
      defaults: {
        caregiverId: caregiver.id,
        patientId,
        status: "pending",
        ...permissionData,
      },
    });

    if (!created) {
      if (link.status === "rejected") {
        await link.update({ ...permissionData, status: "pending" });
      } else if (Object.keys(permissionData).length > 0) {
        await link.update(permissionData);
      }
    }

    return res.status(created ? 201 : 200).json({
      message: link.status === "active" ? "Caregiver already linked." : "Caregiver request sent.",
      assignment: {
        caregiverId: caregiver.id,
        caregiverEmail: caregiver.email,
        patientId,
        status: link.status,
        permissions: {
          canViewMedications: link.canViewMedications,
          canViewSymptoms: link.canViewSymptoms,
          canViewAppointments: link.canViewAppointments,
          canMessageDoctor: link.canMessageDoctor,
          canReceiveReminders: link.canReceiveReminders,
        },
      },
    });
  } catch (err) {
    console.error("assign caregiver error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function updateCaregiverPermissions(req, res) {
  try {
    if (req.user?.role !== "patient") {
      return res.status(403).json({ message: "Only patients can update caregiver permissions." });
    }

    const patientId = req.user.id;
    const caregiverId = req.params.caregiverId;
    const updates = normalizePermissionPayload(req.body || {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid permission fields provided." });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId, status: "active" },
    });
    if (!link) {
      return res.status(404).json({ message: "Caregiver assignment not found." });
    }

    await link.update(updates);
    return res.json({
      message: "Permissions updated.",
      permissions: {
        canViewMedications: link.canViewMedications,
        canViewSymptoms: link.canViewSymptoms,
        canViewAppointments: link.canViewAppointments,
        canMessageDoctor: link.canMessageDoctor,
        canReceiveReminders: link.canReceiveReminders,
      },
    });
  } catch (err) {
    console.error("update caregiver permissions error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function removeCaregiverAssignment(req, res) {
  try {
    if (req.user?.role !== "patient") {
      return res.status(403).json({ message: "Only patients can remove caregiver assignments." });
    }

    const patientId = req.user.id;
    const caregiverId = req.params.caregiverId;

    const deleted = await CaregiverPatientPermission.destroy({
      where: { caregiverId, patientId },
    });

    if (!deleted) return res.status(404).json({ message: "Caregiver assignment not found." });
    return res.status(204).send();
  } catch (err) {
    console.error("remove caregiver assignment error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function listMyCaregivers(req, res) {
  try {
    if (req.user?.role !== "patient") {
      return res.status(403).json({ message: "Only patients can view this." });
    }

    const patientId = req.user.id;
    const links = await CaregiverPatientPermission.findAll({
      where: { patientId, status: "active" },
      order: [["updatedAt", "DESC"]],
    });

    const caregiverIds = links.map((l) => l.caregiverId);
    const caregivers = caregiverIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: caregiverIds } },
          attributes: ["id", "email", "role"],
        })
      : [];

    const caregiverMap = new Map(caregivers.map((c) => [c.id, c]));
    return res.json({
      patientId,
      caregivers: links.map((link) => ({
        caregiver: caregiverMap.get(link.caregiverId) || {
          id: link.caregiverId,
          email: null,
          role: "caregiver",
        },
        permissions: {
          canViewMedications: link.canViewMedications,
          canViewSymptoms: link.canViewSymptoms,
          canViewAppointments: link.canViewAppointments,
          canMessageDoctor: link.canMessageDoctor,
          canReceiveReminders: link.canReceiveReminders,
        },
      })),
    });
  } catch (err) {
    console.error("list my caregivers error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function listPatientsUnderCare(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const links = await CaregiverPatientPermission.findAll({
      where: { caregiverId, status: "active" },
      order: [["updatedAt", "DESC"]],
    });

    const patientIds = links.map((l) => l.patientId);
    const patients = patientIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: patientIds } },
          attributes: ["id", "email", "role"],
        })
      : [];
    const profileMap = await getPatientDisplayProfiles(patientIds);

    const patientMap = new Map(patients.map((p) => [p.id, p]));
    return res.json({
      caregiverId,
      patients: links.map((link) => ({
        patient: (() => {
          const patient = patientMap.get(link.patientId);
          const profile = profileMap.get(link.patientId);
          if (!patient) {
            return {
              id: link.patientId,
              email: null,
              role: "patient",
              displayName: "Patient",
              phoneNumber: null,
            };
          }

          return {
            id: patient.id,
            email: patient.email,
            role: patient.role,
            displayName:
              [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
              patient.email ||
              "Patient",
            phoneNumber: profile?.phoneNumber || null,
          };
        })(),
        permissions: {
          canViewMedications: link.canViewMedications,
          canViewSymptoms: link.canViewSymptoms,
          canViewAppointments: link.canViewAppointments,
          canMessageDoctor: link.canMessageDoctor,
          canReceiveReminders: link.canReceiveReminders,
        },
      })),
    });
  } catch (err) {
    console.error("list patients under care error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function listCaregiverRequests(req, res) {
  try {
    if (req.user?.role === "caregiver") {
      const links = await CaregiverPatientPermission.findAll({
        where: { caregiverId: req.user.id, status: "pending" },
        order: [["createdAt", "DESC"]],
      });
      const patientIds = links.map((link) => link.patientId);
      const patients = patientIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: patientIds } },
            attributes: ["id", "email", "role"],
          })
        : [];
      const patientMap = new Map(patients.map((patient) => [patient.id, patient]));
      const profileMap = await getPatientDisplayProfiles(patientIds);

      return res.json({
        requests: links.map((link) => {
          const patient = patientMap.get(link.patientId);
          const profile = profileMap.get(link.patientId);
          return {
            caregiverId: link.caregiverId,
            patientId: link.patientId,
            status: link.status,
            createdAt: link.createdAt,
            patient: patient
              ? {
                  id: patient.id,
                  email: patient.email,
                  role: patient.role,
                  firstName: profile?.firstName || null,
                  lastName: profile?.lastName || null,
                  displayName:
                    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
                    patient.email,
                }
              : null,
            permissions: {
              canViewMedications: link.canViewMedications,
              canViewSymptoms: link.canViewSymptoms,
              canViewAppointments: link.canViewAppointments,
              canMessageDoctor: link.canMessageDoctor,
              canReceiveReminders: link.canReceiveReminders,
            },
          };
        }),
      });
    }

    if (req.user?.role === "patient") {
      const links = await CaregiverPatientPermission.findAll({
        where: { patientId: req.user.id, status: "pending" },
        order: [["createdAt", "DESC"]],
      });
      const caregiverIds = links.map((link) => link.caregiverId);
      const caregivers = caregiverIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: caregiverIds } },
            attributes: ["id", "email", "role"],
          })
        : [];
      const caregiverMap = new Map(caregivers.map((caregiver) => [caregiver.id, caregiver]));

      return res.json({
        requests: links.map((link) => ({
          caregiverId: link.caregiverId,
          patientId: link.patientId,
          status: link.status,
          createdAt: link.createdAt,
          caregiver: caregiverMap.get(link.caregiverId) || null,
          permissions: {
            canViewMedications: link.canViewMedications,
            canViewSymptoms: link.canViewSymptoms,
            canViewAppointments: link.canViewAppointments,
            canMessageDoctor: link.canMessageDoctor,
            canReceiveReminders: link.canReceiveReminders,
          },
        })),
      });
    }

    return res.status(403).json({ message: "Only caregivers or patients can view caregiver requests." });
  } catch (err) {
    console.error("list caregiver requests error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function reviewCaregiverRequest(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can review caregiver requests." });
    }

    const { patientId } = req.params;
    const decision = String(req.body?.status || "").toLowerCase().trim();
    if (!["active", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "status must be active or rejected." });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId: req.user.id, patientId, status: "pending" },
    });
    if (!link) {
      return res.status(404).json({ message: "Pending caregiver request not found." });
    }

    if (decision === "active") {
      const conflictingLink = await CaregiverPatientPermission.findOne({
        where: {
          patientId,
          status: { [Op.in]: ["pending", "active"] },
          caregiverId: { [Op.ne]: req.user.id },
        },
      });
      if (conflictingLink) {
        return res.status(409).json({
          message: "Patient already has another caregiver link or pending caregiver request.",
        });
      }
    }

    await link.update({ status: decision });
    return res.json({
      message: decision === "active" ? "Caregiver request approved." : "Caregiver request rejected.",
      assignment: {
        caregiverId: link.caregiverId,
        patientId: link.patientId,
        status: link.status,
      },
    });
  } catch (err) {
    console.error("review caregiver request error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

export async function getCaregiverPatientMedications(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const link = await requireCaregiverPermissionOrThrow(caregiverId, patientId, "canViewMedications");
    if (!link) return res.status(403).json({ message: "Permission denied for medications." });

    const medications = await Medication.findAll({
      where: { patientId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({ patientId, count: medications.length, medications });
  } catch (err) {
    console.error("caregiver medications error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function getCaregiverPatientSymptoms(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const link = await requireCaregiverPermissionOrThrow(caregiverId, patientId, "canViewSymptoms");
    if (!link) return res.status(403).json({ message: "Permission denied for symptoms." });

    const symptoms = await Symptom.findAll({
      where: { patientId },
      order: [["loggedAt", "DESC"], ["createdAt", "DESC"]],
    });

    return res.json({ patientId, count: symptoms.length, symptoms });
  } catch (err) {
    console.error("caregiver symptoms error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function getCaregiverPatientAppointments(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const link = await requireCaregiverPermissionOrThrow(caregiverId, patientId, "canViewAppointments");
    if (!link) return res.status(403).json({ message: "Permission denied for appointments." });

    const appointments = await Appointment.findAll({
      where: { patientId },
      include: [{ model: User, as: "doctor", attributes: ["id", "email"] }],
      order: [["startsAt", "ASC"]],
    });

    const doctorIds = appointments
      .map((appointment) => appointment.doctor?.id)
      .filter(Boolean);
    const doctorProfileMap = await getPatientDisplayProfiles(doctorIds);

    return res.json({
      patientId,
      count: appointments.length,
      appointments: appointments.map((a) => ({
        id: a.id,
        doctorId: a.doctorId,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status,
        location: a.location,
        notes: a.notes,
        rescheduleRequestedBy: a.rescheduleRequestedBy,
        proposedStartsAt: a.proposedStartsAt,
        proposedEndsAt: a.proposedEndsAt,
        proposedLocation: a.proposedLocation,
        rescheduleNotes: a.rescheduleNotes,
        doctor: a.doctor
          ? {
              id: a.doctor.id,
              email: a.doctor.email,
              displayName:
                [doctorProfileMap.get(a.doctor.id)?.firstName, doctorProfileMap.get(a.doctor.id)?.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || a.doctor.email || "Doctor",
              phoneNumber: doctorProfileMap.get(a.doctor.id)?.phoneNumber || null,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("caregiver appointments error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function getCaregiverPatientHealthData(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;

    const link = await getCaregiverPermission(caregiverId, patientId);
    if (!link) {
      return res.status(403).json({ message: "Permission denied for this patient." });
    }

    const [patient, medications, symptoms, appointments] = await Promise.all([
      User.findByPk(patientId, { attributes: ["id", "email", "role"] }),
      link.canViewMedications
        ? Medication.findAll({
            where: { patientId },
            order: [["createdAt", "DESC"]],
          })
        : Promise.resolve(null),
      link.canViewSymptoms
        ? Symptom.findAll({
            where: { patientId },
            order: [["loggedAt", "DESC"], ["createdAt", "DESC"]],
          })
        : Promise.resolve(null),
      link.canViewAppointments
        ? Appointment.findAll({
            where: { patientId },
            include: [{ model: User, as: "doctor", attributes: ["id", "email"] }],
            order: [["startsAt", "ASC"]],
          })
        : Promise.resolve(null),
    ]);

    if (!patient || patient.role !== "patient") {
      return res.status(404).json({ message: "Patient not found." });
    }

    return res.json({
      caregiverId,
      patient: {
        id: patient.id,
        email: patient.email,
      },
      permissions: {
        canViewMedications: link.canViewMedications,
        canViewSymptoms: link.canViewSymptoms,
        canViewAppointments: link.canViewAppointments,
        canMessageDoctor: link.canMessageDoctor,
        canReceiveReminders: link.canReceiveReminders,
      },
      healthData: {
        medications: link.canViewMedications
          ? { enabled: true, count: medications.length, items: medications }
          : { enabled: false, count: 0, items: [] },
        symptoms: link.canViewSymptoms
          ? { enabled: true, count: symptoms.length, items: symptoms }
          : { enabled: false, count: 0, items: [] },
        appointments: link.canViewAppointments
          ? {
              enabled: true,
              count: appointments.length,
              items: appointments.map((a) => ({
                id: a.id,
                doctorId: a.doctorId,
                startsAt: a.startsAt,
                endsAt: a.endsAt,
                status: a.status,
                location: a.location,
                notes: a.notes,
                doctor: a.doctor ? { id: a.doctor.id, email: a.doctor.email } : null,
              })),
            }
          : { enabled: false, count: 0, items: [] },
      },
    });
  } catch (err) {
    console.error("caregiver health-data error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}
export async function getCaregiverDashboardData(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can view this.' });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;

    // Get the permission record — exact field names from CaregiverPatientPermission model
    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link) {
      return res.status(403).json({
        message: 'You are not linked to this patient.',
      });
    }

    // Fetch all data in parallel, gated by permissions
    const [medications, nextAppointment, recentSymptoms, recentCareNotes] =
      await Promise.all([

        // canViewMedications — exact field from CaregiverPatientPermission
        link.canViewMedications
          ? Medication.findAll({
              where: { patientId },
              order: [['createdAt', 'DESC']],
              limit: 5,
            })
          : Promise.resolve(null),

        // Appointment.status exact values: 'scheduled' | 'cancelled' | 'completed'
        // canViewAppointments — exact field from CaregiverPatientPermission
        link.canViewAppointments
          ? Appointment.findOne({
              where: {
                patientId,
                status: 'scheduled',
                startsAt: { [Op.gte]: new Date() },
              },
              include: [
                {
                  // 'doctor' alias — exact from models/index.js Appointment associations
                  model: User,
                  as: 'doctor',
                  attributes: ['id', 'email'],
                },
              ],
              order: [['startsAt', 'ASC']],
            })
          : Promise.resolve(null),

        // canViewSymptoms — exact field from CaregiverPatientPermission
        link.canViewSymptoms
          ? Symptom.findAll({
              where: { patientId },
              order: [['createdAt', 'DESC']],
              limit: 3,
            })
          : Promise.resolve(null),

        // CaregiverNote fields: id, note, patientId, caregiverId, createdAt
        CaregiverNote.findAll({
          where: { caregiverId, patientId },
          order: [['createdAt', 'DESC']],
          limit: 3,
        }),
      ]);

    return res.json({
      caregiverId,
      patientId,
      // Return all permission keys so frontend can gate UI correctly
      // Exact field names from CaregiverPatientPermission model
      permissions: {
        canViewMedications: link.canViewMedications,
        canViewSymptoms: link.canViewSymptoms,
        canViewAppointments: link.canViewAppointments,
        canMessageDoctor: link.canMessageDoctor,
        canReceiveReminders: link.canReceiveReminders,
      },
      dashboard: {
        
        medications: link.canViewMedications
          ? { enabled: true, items: medications }
          : { enabled: false, items: [] },

        nextAppointment: link.canViewAppointments
          ? {
              enabled: true,
              appointment: nextAppointment
                ? {
                    id: nextAppointment.id,
                    startsAt: nextAppointment.startsAt,
                    endsAt: nextAppointment.endsAt,
                    status: nextAppointment.status,
                    location: nextAppointment.location,
                    notes: nextAppointment.notes,
                    doctor: nextAppointment.doctor
                      ? {
                          id: nextAppointment.doctor.id,
                          email: nextAppointment.doctor.email,
                        }
                      : null,
                  }
                : null,
            }
          : { enabled: false, appointment: null },

        recentSymptoms: link.canViewSymptoms
          ? { enabled: true, items: recentSymptoms }
          : { enabled: false, items: [] },

        recentCareNotes: {
          enabled: true,
          items: recentCareNotes.map((n) => ({
            id: n.id,
            note: n.note,
            createdAt: n.createdAt,
          })),
        },
      },
    });
  } catch (err) {
    console.error('getCaregiverDashboardData error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}

export async function getCaregiverPatientDoctors(req, res) {
  try {
    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const link = await requireCaregiverPermissionOrThrow(caregiverId, patientId, "canViewAppointments");
    if (!link) return res.status(403).json({ message: "Permission denied for appointments." });

    const assignments = await DoctorPatientAssignment.findAll({
      where: { patientId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    const doctorIds = Array.from(new Set(assignments.map((item) => item.doctorId).filter(Boolean)));
    const doctors = await User.findAll({
      where: { id: doctorIds, role: "doctor" },
      attributes: ["id", "email"],
    });
    const doctorById = new Map(doctors.map((item) => [item.id, item]));
    const doctorProfileMap = await getPatientDisplayProfiles(doctorIds);

    return res.json({
      patientId,
      count: assignments.length,
      doctors: assignments.map((item) => ({
        id: item.doctorId,
        email: doctorById.get(item.doctorId)?.email || null,
        displayName:
          [doctorProfileMap.get(item.doctorId)?.firstName, doctorProfileMap.get(item.doctorId)?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || doctorById.get(item.doctorId)?.email || "Doctor",
      })),
    });
  } catch (err) {
    console.error("caregiver patient doctors error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

export async function getCaregiverPatientAppointmentAvailability(req, res) {
  try {
    await ensureAppointmentSchemaReady();

    if (req.user?.role !== "caregiver") {
      return res.status(403).json({ message: "Only caregivers can view this." });
    }

    const caregiverId = req.user.id;
    const { patientId } = req.params;
    const link = await requireCaregiverPermissionOrThrow(caregiverId, patientId, "canViewAppointments");
    if (!link) return res.status(403).json({ message: "Permission denied for appointments." });

    const from = new Date(req.query.from);
    const to = new Date(req.query.to);
    const slotMinutes = Number(req.query.slotMinutes || 30);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      return res.status(400).json({ message: "from/to must be a valid date range." });
    }

    if (!Number.isInteger(slotMinutes) || slotMinutes <= 0 || slotMinutes > 240) {
      return res.status(400).json({ message: "slotMinutes must be an integer between 1 and 240" });
    }

    const requestedDoctorId = String(req.query.doctorId || "").trim();

    const assignments = await DoctorPatientAssignment.findAll({
      where: { patientId, status: "active" },
      order: [["createdAt", "DESC"]],
    });

    if (assignments.length === 0) {
      return res.status(400).json({
        message: "Patient has no active doctor. No appointment slots are available.",
      });
    }

    const doctorIds = Array.from(new Set(assignments.map((item) => item.doctorId).filter(Boolean)));
    const doctors = await User.findAll({
      where: { id: doctorIds, role: "doctor" },
      attributes: ["id", "email"],
    });
    const doctorById = new Map(doctors.map((item) => [item.id, item]));

    const selectedAssignment = requestedDoctorId
      ? assignments.find((item) => item.doctorId === requestedDoctorId)
      : assignments[0];

    if (requestedDoctorId && !selectedAssignment) {
      return res.status(400).json({
        message: "Selected doctor is not actively linked to this patient.",
      });
    }

    const doctorProfileMap = await getPatientDisplayProfiles([selectedAssignment.doctorId]);
    const selectedDoctor = doctorById.get(selectedAssignment.doctorId);
    const slots = await buildDoctorAvailability({
      doctorId: selectedAssignment.doctorId,
      from,
      to,
      slotMinutes,
    });

    return res.json({
      patientId,
      doctorId: selectedAssignment.doctorId,
      doctor: {
        id: selectedAssignment.doctorId,
        email: selectedDoctor?.email || null,
        displayName:
          [doctorProfileMap.get(selectedAssignment.doctorId)?.firstName, doctorProfileMap.get(selectedAssignment.doctorId)?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || selectedDoctor?.email || "Doctor",
      },
      from,
      to,
      slotMinutes,
      count: slots.length,
      slots,
    });
  } catch (err) {
    console.error("caregiver appointment availability error:", err);
    return res.status(500).json({
      message: err.message || "Failed to fetch appointment availability.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}