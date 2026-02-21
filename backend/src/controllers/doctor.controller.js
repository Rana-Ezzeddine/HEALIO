import sequelize from "../../database.js";

export const getAssignedPatients = async (req, res) => {
  try {
    if (req.user?.role !== "doctor") {
      return res.status(403).json({ message: "Only doctors can access this." });
    }

    const doctorId = req.user.id;

    const [rows] = await sequelize.query(
      `
      SELECT
        dpa.status,
        dpa."createdAt" AS "assignedAt",
        u.id,
        u.email,
        u.role,
        u."isVerified"
      FROM doctor_patient_assignments dpa
      JOIN users u ON u.id = dpa."patientId"
      WHERE dpa."doctorId" = :doctorId
        AND dpa.status = 'active'
      ORDER BY dpa."createdAt" DESC
      `,
      { replacements: { doctorId } }
    );

    return res.json({
      doctorId,
      patients: rows.map((r) => ({
        status: r.status,
        assignedAt: r.assignedAt,
        patient: {
          id: r.id,
          email: r.email,
          role: r.role,
          isVerified: r.isVerified,
        },
      })),
    });
  } catch (err) {
    console.error("doctor assigned-patients error:", err);
    return res.status(500).json({
      message: "Server error.",
      debug: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};