import Conversation from '../models/Conversation.js';
import ConversationParticipant from '../models/ConversationParticipant.js';
import Message from '../models/Message.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import User from '../models/User.js';

export async function sendCareConcern(req, res) {
  try {
    if (req.user?.role !== 'caregiver') {
      return res.status(403).json({ message: 'Only caregivers can send care concerns.' });
    }

    const caregiverId = req.user.id;
    const { patientId, concern, context } = req.body || {};

    if (!patientId) {
      return res.status(400).json({ message: 'patientId is required.' });
    }

    const concernText = typeof concern === 'string' ? concern.trim() : '';
    if (!concernText) {
      return res.status(400).json({ message: 'concern is required.' });
    }

    const link = await CaregiverPatientPermission.findOne({
      where: { caregiverId, patientId },
    });

    if (!link) {
      return res.status(403).json({ message: 'You are not linked to this patient.' });
    }

    if (!link.canMessageDoctor) {
      return res.status(403).json({
        message: 'You do not have permission to contact this patient\'s doctor.',
      });
    }

    const doctorAssignment = await DoctorPatientAssignment.findOne({
      where: { patientId, status: 'active' },
    });

    if (!doctorAssignment) {
      return res.status(400).json({
        message: 'Patient has no active doctor to send the concern to.',
      });
    }

    const doctorId = doctorAssignment.doctorId;

    const existingConversation = await Conversation.findOne({
      include: [
        {
          model: ConversationParticipant,
          as: 'participants',
          where: { userId: caregiverId },
          required: true,
        },
      ],
    }).then(async (conv) => {
      if (!conv) return null;
      const hasDoctor = await ConversationParticipant.findOne({
        where: { conversationId: conv.id, userId: doctorId },
      });
      return hasDoctor ? conv : null;
    });

    let conversation = existingConversation;
    if (!conversation) {
      conversation = await Conversation.create({});
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: caregiverId },
        { conversationId: conversation.id, userId: doctorId },
      ]);
    }

    const messageBody = JSON.stringify({
      type: 'care_concern',
      concern: concernText,
      context: typeof context === 'string' ? context.trim() : null,
      patientId,
      sentByCaregiver: true,
    });

    const message = await Message.create({
      conversationId: conversation.id,
      senderId: caregiverId,
      body: messageBody,
    });

    return res.status(201).json({
      message: 'Care concern sent to doctor.',
      conversationId: conversation.id,
      concern: {
        id: message.id,
        type: 'care_concern',
        concern: concernText,
        context: typeof context === 'string' ? context.trim() : null,
        patientId,
        sentAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error('sendCareConcern error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}