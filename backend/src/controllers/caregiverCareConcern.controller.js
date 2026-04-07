import Conversation from '../models/Conversation.js';
import ConversationParticipant from '../models/ConversationParticipant.js';
import Message from '../models/Message.js';
import CaregiverPatientPermission from '../models/CaregiverPatientPermission.js';
import DoctorPatientAssignment from '../models/DoctorPatientAssignment.js';
import { Op } from 'sequelize';

async function findDirectConversation(caregiverId, doctorId) {
  const caregiverParticipantRows = await ConversationParticipant.findAll({
    where: { userId: caregiverId },
    attributes: ['conversationId'],
    raw: true,
  });

  if (caregiverParticipantRows.length === 0) {
    return null;
  }

  const caregiverConversationIds = caregiverParticipantRows.map((row) => row.conversationId);

  const sharedRows = await ConversationParticipant.findAll({
    where: {
      userId: doctorId,
      conversationId: { [Op.in]: caregiverConversationIds },
    },
    attributes: ['conversationId'],
    raw: true,
  });

  if (sharedRows.length === 0) {
    return null;
  }

  const sharedConversationIds = sharedRows.map((row) => row.conversationId);

  const candidateConversations = await Conversation.findAll({
    where: { id: { [Op.in]: sharedConversationIds } },
    order: [['updatedAt', 'DESC']],
  });

  for (const conversation of candidateConversations) {
    const participantRows = await ConversationParticipant.findAll({
      where: { conversationId: conversation.id },
      attributes: ['userId'],
      raw: true,
    });

    const participantIds = participantRows.map((row) => row.userId);
    const uniqueIds = new Set(participantIds);
    if (uniqueIds.size === 2 && uniqueIds.has(caregiverId) && uniqueIds.has(doctorId)) {
      return conversation;
    }
  }

  return candidateConversations[0] || null;
}

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
      order: [['updatedAt', 'DESC']],
    });

    if (!doctorAssignment) {
      return res.status(400).json({
        message: 'Patient has no active doctor to send the concern to.',
      });
    }

    const doctorId = doctorAssignment.doctorId;

    let conversation = await findDirectConversation(caregiverId, doctorId);
    if (!conversation) {
      conversation = await Conversation.create({});
      await ConversationParticipant.bulkCreate([
        { conversationId: conversation.id, userId: caregiverId },
        { conversationId: conversation.id, userId: doctorId },
      ]);
    }

    const contextText = typeof context === 'string' ? context.trim() : '';
    const messageBody = [
      'Care concern from caregiver',
      `Patient ID: ${patientId}`,
      `Concern: ${concernText}`,
      contextText ? `Context: ${contextText}` : null,
    ]
      .filter(Boolean)
      .join('\n');

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
        context: contextText || null,
        patientId,
        sentAt: message.createdAt,
      },
    });
  } catch (err) {
    console.error('sendCareConcern error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}