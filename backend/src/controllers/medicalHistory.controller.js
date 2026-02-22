import Symptom from "../models/Symptom.js";
import Medication from "../models/Medication.js";

export const getMyMedicalHistory = async (req, res) => {
  try {
    // requireUser should set this
    const patientId = req.user?.id;
    if (!patientId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const [symptoms, medications] = await Promise.all([
      Symptom.findAll({
        where: { patientId },
        order: [["loggedAt", "DESC"], ["createdAt", "DESC"]],
      }),
      Medication.findAll({
        where: { patientId },
        order: [["createdAt", "DESC"]],
      }),
    ]);

    return res.json({ symptoms, medications });
  } catch (err) {
    console.error("medical-history error:", err);

    return res.status(500).json({
      message: "Failed to fetch medical history.",
      // temporary debug (dev only)
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
