import Appointment from './src/models/Appointment.js';
import PatientProfile from './src/models/PatientProfile.js';
import User from './src/models/User.js';
import './src/models/index.js'; // Loads all associations

// Initialize test
async function convertScheduledToReschedule() {
  try {
    // Get patient ID from command line or find all scheduled
    const patientEmail = process.argv[2]; // e.g., node test-reschedule.js user@example.com
    
    let where = { status: 'scheduled' };
    let include = [
      { model: User, as: 'patient' },
      { model: User, as: 'doctor' }
    ];

    if (patientEmail) {
      const patient = await User.findOne({ where: { email: patientEmail } });
      if (!patient) {
        console.log(`Patient with email ${patientEmail} not found.`);
        return;
      }
      where.patientId = patient.id;
    }

    // Find first scheduled appointment
    const scheduled = await Appointment.findOne({
      where,
      include
    });

    if (!scheduled) {
      if (patientEmail) {
        console.log(`No scheduled appointments found for ${patientEmail}.`);
      } else {
        console.log('No scheduled appointments found.');
      }
      console.log('\nUsage: node test-reschedule.js [patient@email.com]');
      console.log('Example: node test-reschedule.js john@example.com');
      return;
    }

    console.log('Found appointment:', {
      id: scheduled.id,
      patient: scheduled.patient?.email,
      doctor: scheduled.doctor?.email,
      startsAt: scheduled.startsAt,
      status: scheduled.status
    });

    // Propose a reschedule: 2 hours later than original
    const proposedStart = new Date(scheduled.startsAt);
    proposedStart.setHours(proposedStart.getHours() + 2);
    const proposedEnd = new Date(proposedStart);
    proposedEnd.setMinutes(proposedEnd.getMinutes() + 30);

    // Force rescheduleRequestedBy to 'doctor' (in case it was previously 'patient')
    const result = await scheduled.update({
      status: 'reschedule_requested',
      rescheduleRequestedBy: 'doctor',
      proposedStartsAt: proposedStart,
      proposedEndsAt: proposedEnd,
      rescheduleNotes: 'Doctor suggests moving to a different time slot.',
      proposedLocation: scheduled.location || 'Same location'
    });

    console.log('Updated to:', {
      status: result.status,
      rescheduleRequestedBy: result.rescheduleRequestedBy,
      proposedStartsAt: result.proposedStartsAt
    });

    console.log('✓ Updated appointment to reschedule_requested');
    console.log('Proposed new time:', proposedStart.toISOString());
    console.log('\nNow go to Caregiver Appointments page and you should see the approve/deny buttons!');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

convertScheduledToReschedule();
