import Medication from '../models/Medication.js';
import Appointment from '../models/Appointment.js';
import Symptom from '../models/Symptom.js';
import { Op } from 'sequelize';

function startOfDayFromValue(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]) - 1;
      const day = Number(dateOnly[3]);
      return new Date(year, month, day);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

// Get patient dashboard with aggregated medical data
export const getPatientDashboard = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allMedications = await Medication.findAll({
      where: { patientId }
    });

    const activeMedications = allMedications.filter(med =>
      !med.endDate || new Date(med.endDate) >= today
    );

    const nextDose = activeMedications.length > 0 ? {
      medication: activeMedications[0].name,
      time: "8:00 PM",
      dosage: activeMedications[0].dosage
    } : null;
    const nextAppointment = await Appointment.findOne({
      where: {
        patientId,
        startsAt: {
          [Op.gte]: today
        }
      },
      order: [['startsAt', 'ASC']]
    });

    let appointmentData = {
      icon: "📅",
      label: "Next Appointment",
      date: "No appointments",
      countdown: "",
      viewLink: "/appointments"
    };

    if (nextAppointment) {
      const appointmentDate = new Date(nextAppointment.startsAt);
      const daysUntil = Math.ceil((appointmentDate - today) / (1000 * 60 * 60 * 24));

      appointmentData = {
        icon: "📅",
        label: "Next Appointment",
        date: appointmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        countdown: daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`,
        viewLink: "/appointments"
      };
    }

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingAppointments = await Appointment.findAll({
      where: {
        patientId,
        startsAt: {
          [Op.between]: [today, thirtyDaysFromNow]
        }
      },
      order: [['startsAt', 'ASC']],
      limit: 5
    });

    const lastSymptom = await Symptom.findOne({
      where: { patientId },
      order: [['loggedAt', 'DESC'], ['createdAt', 'DESC']]
    });

    let symptomData = {
      icon: "😊",
      label: "Last Symptom Logged",
      when: "No symptoms logged",
      viewLink: "/symptoms"
    };

    if (lastSymptom) {
      const symptomDate = startOfDayFromValue(lastSymptom.loggedAt || lastSymptom.createdAt);
      const daysSince = symptomDate
        ? Math.floor((today - symptomDate) / (1000 * 60 * 60 * 24))
        : null;

      let whenText;
      if (daysSince === null) whenText = "No symptoms logged";
      else if (daysSince <= 0) whenText = "Today";
      else if (daysSince === 1) whenText = "Yesterday";
      else whenText = `${daysSince} days ago`;

      symptomData = {
        icon: "😊",
        label: "Last Symptom Logged",
        when: whenText,
        symptomName: lastSymptom.name || lastSymptom.symptom,
        viewLink: "/symptoms"
      };
    }

    const dashboard = {
      welcomeMessage: "Welcome Back, Patient",
      subtitle: "Here's a quick overview of your health",

      topCards: {
        activeMedications: {
          icon: "💊",
          label: "Active Medications",
          count: activeMedications.length,
          unit: "Medications",
          nextDose: nextDose ? {
            text: `Next dose: ${nextDose.medication} - ${nextDose.time}`,
            medication: nextDose.medication,
            time: nextDose.time
          } : null,
          viewLink: "/medications"
        },
        nextAppointment: appointmentData,
        lastSymptomLogged: symptomData
      },

      upcomingAppointments: {
        title: "Upcoming Appointments",
        hasAppointments: upcomingAppointments.length > 0,
        message: upcomingAppointments.length === 0 ? "No upcoming appointments yet." : null,
        appointments: upcomingAppointments.map(apt => ({
          id: apt.id,
          date: new Date(apt.startsAt).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          }),
          time: new Date(apt.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          doctorName: apt.doctorName || "Doctor TBD",
          type: apt.type || "General",
          status: apt.status || "scheduled"
        }))
      },

      quickActions: {
        title: "Quick Actions",
        actions: [
          {
            id: "book-appointment",
            label: "Book Appointment",
            color: "blue",
            icon: "📅"
          },
          {
            id: "view-records",
            label: "View Records",
            color: "purple",
            icon: "📋"
          },
          {
            id: "message-doctor",
            label: "Message Doctor",
            color: "green",
            icon: "💬"
          }
        ]
      },

      medicalSummary: {
        activeMedications: activeMedications.map(med => ({
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          prescribedBy: med.prescribedBy,
          startDate: med.startDate,
          endDate: med.endDate,
          notes: med.notes
        })),
        medicationCount: activeMedications.length,
        recentSymptoms: lastSymptom ? [{
          id: lastSymptom.id,
          name: lastSymptom.name || lastSymptom.symptom,
          date: lastSymptom.loggedAt || lastSymptom.createdAt,
          severity: lastSymptom.severity
        }] : [],
        lastSymptomDate: lastSymptom
          ? (startOfDayFromValue(lastSymptom.loggedAt || lastSymptom.createdAt)?.toLocaleDateString() || null)
          : null
      }
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching patient dashboard:', error);
    res.status(500).json({
      error: 'Failed to fetch patient dashboard',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getMedicationStats = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allMedications = await Medication.findAll({
      where: { patientId }
    });

    const frequencyDistribution = {};
    allMedications.forEach(med => {
      const freq = med.frequency || 'Not specified';
      frequencyDistribution[freq] = (frequencyDistribution[freq] || 0) + 1;
    });

    const active = allMedications.filter(med =>
      !med.endDate || new Date(med.endDate) >= today
    ).length;
    const inactive = allMedications.length - active;

    const stats = {
      statusDistribution: {
        active,
        inactive
      },
      frequencyDistribution,
      totalMedications: allMedications.length
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching medication stats:', error);
    res.status(500).json({ error: 'Failed to fetch medication stats' });
  }
};

export const getActiveMedications = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeMedications = await Medication.findAll({
      where: {
        patientId,
        [Op.or]: [
          { endDate: null },
          { endDate: { [Op.gte]: today } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(activeMedications);
  } catch (error) {
    console.error('Error fetching active medications:', error);
    res.status(500).json({ error: 'Failed to fetch active medications' });
  }
};

export const getMedicationsByDoctor = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { doctor } = req.params;

    const medications = await Medication.findAll({
      where: {
        patientId,
        prescribedBy: doctor
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      doctor,
      count: medications.length,
      medications
    });
  } catch (error) {
    console.error('Error fetching medications by doctor:', error);
    res.status(500).json({ error: 'Failed to fetch medications by doctor' });
  }
};

export const getUpcomingMedications = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?.sub;
    if (!patientId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingMedications = await Medication.findAll({
      where: {
        patientId,
        startDate: {
          [Op.gt]: today,
          [Op.lte]: thirtyDaysFromNow
        }
      },
      order: [['startDate', 'ASC']]
    });

    res.json(upcomingMedications);
  } catch (error) {
    console.error('Error fetching upcoming medications:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming medications' });
  }
};
