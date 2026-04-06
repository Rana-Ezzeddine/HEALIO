import { QueryTypes } from "sequelize";
import sequelize from "../../database.js";
import {
    User,
    PatientProfile,
    Conversation,
    ConversationParticipant,
    Message,
    CommunicationContext,
    DoctorPatientAssignment,
    CaregiverPatientPermission,
} from "../models/index.js";

let messagesContextColumnSupported = null;

function buildDisplayName(email, firstName, lastName) {
    return [firstName, lastName].filter(Boolean).join(" ").trim() || email;
}

async function getUserProfileMap(userIds = []) {
    const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
    if (!uniqueIds.length) return new Map();

    const profiles = await PatientProfile.findAll({
        where: { userId: uniqueIds },
        attributes: ["userId", "firstName", "lastName"],
    });

    return new Map(profiles.map((profile) => [profile.userId, profile]));
}

function toUserWithDisplayName(user, profileMap) {
    if (!user) return null;

    const profile = profileMap.get(user.id);
    const firstName = profile?.firstName || null;
    const lastName = profile?.lastName || null;

    return {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        firstName,
        lastName,
        displayName: buildDisplayName(user.email, firstName, lastName),
    };
}

function cleanBody(value) {
    if (typeof value !== "string") return null;
    const s = value.trim();
    return s.length ? s : null;
}

async function ensureConversationMember(conversationId, userId) {
    const membership = await ConversationParticipant.findOne({
        where: { conversationId, userId },
    });
    return !!membership;
}

async function supportsMessageContextColumn() {
    if (messagesContextColumnSupported !== null) {
        return messagesContextColumnSupported;
    }

    try {
        const description = await sequelize.getQueryInterface().describeTable("messages");
        messagesContextColumnSupported = !!description?.contextId;
    } catch {
        messagesContextColumnSupported = false;
    }

    return messagesContextColumnSupported;
}

async function getMessageAttributes() {
    const attributes = ["id", "conversationId", "senderId", "body", "sentAt"];
    if (await supportsMessageContextColumn()) {
        attributes.push("contextId");
    }
    return attributes;
}

async function canStartConversation(requester, recipientId, patientId = null) {
    const requesterId = requester.id;
    const requesterRole = requester.role;

    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
        return { ok: false, status: 404, message: "Recipient not found." };
    }

    if (recipient.id === requesterId) {
        return { ok: false, status: 400, message: "You cannot create a conversation with yourself." };
    }

    // patient -> doctor
    if (requesterRole === "patient" && recipient.role === "doctor") {
        const assignment = await DoctorPatientAssignment.findOne({
            where: {
                doctorId: recipient.id,
                patientId: requesterId,
                status: "active",
            },
        });

        if (!assignment) {
            return { ok: false, status: 403, message: "You can only message an assigned doctor." };
        }

        return { ok: true, recipient };
    }

    // patient -> caregiver
    if (requesterRole === "patient" && recipient.role === "caregiver") {
        const permission = await CaregiverPatientPermission.findOne({
            where: {
                caregiverId: recipient.id,
                patientId: requesterId,
                status: "active",
            },
        });

        if (!permission) {
            return { ok: false, status: 403, message: "You can only message a linked caregiver." };
        }

        return { ok: true, recipient };
    }

    // doctor -> patient
    if (requesterRole === "doctor" && recipient.role === "patient") {
        const assignment = await DoctorPatientAssignment.findOne({
            where: {
                doctorId: requesterId,
                patientId: recipient.id,
                status: "active",
            },
        });

        if (!assignment) {
            return { ok: false, status: 403, message: "You can only message assigned patients." };
        }

        return { ok: true, recipient };
    }

    // caregiver -> patient
    if (requesterRole === "caregiver" && recipient.role === "patient") {
        const permission = await CaregiverPatientPermission.findOne({
            where: {
                caregiverId: requesterId,
                patientId: recipient.id,
                status: "active",
            },
        });

        if (!permission) {
            return { ok: false, status: 403, message: "You can only message linked patients." };
        }

        return { ok: true, recipient };
    }

    // caregiver -> doctor (only if caregiver has permission for a patient linked to that doctor)
    if (requesterRole === "caregiver" && recipient.role === "doctor") {
        if (!patientId) {
            return {
                ok: false,
                status: 400,
                message: "patientId is required when a caregiver starts a conversation with a doctor.",
            };
        }

        const permission = await CaregiverPatientPermission.findOne({
            where: {
                caregiverId: requesterId,
                patientId,
                status: "active",
                canMessageDoctor: true,
            },
        });

        if (!permission) {
            return {
                ok: false,
                status: 403,
                message: "You do not have permission to message this patient's doctor.",
            };
        }

        const assignment = await DoctorPatientAssignment.findOne({
            where: {
                doctorId: recipient.id,
                patientId,
                status: "active",
            },
        });

        if (!assignment) {
            return {
                ok: false,
                status: 403,
                message: "That doctor is not actively assigned to the selected patient.",
            };
        }

        return { ok: true, recipient };
    }

    return {
        ok: false,
        status: 403,
        message: "This conversation type is not allowed.",
    };
}

async function findExistingDirectConversation(userAId, userBId) {
    const rows = await sequelize.query(
        `
    SELECT cp1."conversationId"
    FROM conversation_participants cp1
    JOIN conversation_participants cp2
      ON cp1."conversationId" = cp2."conversationId"
    WHERE cp1."userId" = :userAId
      AND cp2."userId" = :userBId
    GROUP BY cp1."conversationId"
    HAVING COUNT(*) = 2
    LIMIT 1
    `,
        {
            replacements: { userAId, userBId },
            type: QueryTypes.SELECT,
        }
    );

    if (!rows.length) return null;
    return rows[0].conversationId;
}

export const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations = await Conversation.findAll({
            include: [
                {
                    model: User,
                    as: "participants",
                    attributes: ["id", "email", "role", "isVerified"],
                    through: { attributes: [] },
                    required: true,
                    where: { id: userId },
                },
            ],
            order: [["updatedAt", "DESC"]],
        });

        const fullConversations = await Promise.all(
            conversations.map(async (conversation) => {
                const participantsRaw = await conversation.getParticipants({
                    attributes: ["id", "email", "role", "isVerified"],
                    joinTableAttributes: [],
                });

                const lastMessage = await Message.findOne({
                    where: { conversationId: conversation.id },
                    attributes: await getMessageAttributes(),
                    order: [["sentAt", "DESC"]],
                    include: [
                        {
                            model: User,
                            as: "sender",
                            attributes: ["id", "email", "role"],
                        },
                    ],
                });

                const profileMap = await getUserProfileMap([
                    ...participantsRaw.map((participant) => participant.id),
                    lastMessage?.sender?.id,
                ]);

                const participants = participantsRaw.map((participant) =>
                    toUserWithDisplayName(participant, profileMap)
                );

                const normalizedLastMessage = lastMessage
                    ? {
                        ...lastMessage.toJSON(),
                        sender: toUserWithDisplayName(lastMessage.sender, profileMap),
                    }
                    : null;

                return {
                    id: conversation.id,
                    createdAt: conversation.createdAt,
                    updatedAt: conversation.updatedAt,
                    participants,
                    lastMessage: normalizedLastMessage,
                };
            })
        );

        return res.json({ conversations: fullConversations });
    } catch (err) {
        console.error("getConversations error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

export const createConversation = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const requester = req.user;
        const { recipientId, patientId } = req.body;

        if (!recipientId) {
            await transaction.rollback();
            return res.status(400).json({ message: "recipientId is required." });
        }

        const authz = await canStartConversation(requester, recipientId, patientId);
        if (!authz.ok) {
            await transaction.rollback();
            return res.status(authz.status).json({ message: authz.message });
        }

        const existingConversationId = await findExistingDirectConversation(
            requester.id,
            recipientId
        );

        if (existingConversationId) {
            await transaction.rollback();
            const existingConversation = await Conversation.findByPk(existingConversationId, {
                include: [
                    {
                        model: User,
                        as: "participants",
                        attributes: ["id", "email", "role", "isVerified"],
                        through: { attributes: [] },
                    },
                ],
            });

            const participants = existingConversation
                ? existingConversation.participants || []
                : [];
            const profileMap = await getUserProfileMap(participants.map((participant) => participant.id));
            const normalizedConversation = existingConversation
                ? {
                    ...existingConversation.toJSON(),
                    participants: participants.map((participant) =>
                        toUserWithDisplayName(participant, profileMap)
                    ),
                }
                : null;

            return res.status(200).json({
                message: "Conversation already exists.",
                conversation: normalizedConversation,
            });
        }

        const conversation = await Conversation.create({}, { transaction });

        await ConversationParticipant.bulkCreate(
            [
                { conversationId: conversation.id, userId: requester.id },
                { conversationId: conversation.id, userId: recipientId },
            ],
            { transaction }
        );

        await transaction.commit();

        const createdConversation = await Conversation.findByPk(conversation.id, {
            include: [
                {
                    model: User,
                    as: "participants",
                    attributes: ["id", "email", "role", "isVerified"],
                    through: { attributes: [] },
                },
            ],
        });

        const createdParticipants = createdConversation
            ? createdConversation.participants || []
            : [];
        const createdProfileMap = await getUserProfileMap(createdParticipants.map((participant) => participant.id));
        const normalizedCreatedConversation = createdConversation
            ? {
                ...createdConversation.toJSON(),
                participants: createdParticipants.map((participant) =>
                    toUserWithDisplayName(participant, createdProfileMap)
                ),
            }
            : null;

        return res.status(201).json({
            message: "Conversation created successfully.",
            conversation: normalizedCreatedConversation,
        });
    } catch (err) {
        await transaction.rollback();
        console.error("createConversation error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

export const getConversationMessages = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const userId = req.user.id;

        const isMember = await ensureConversationMember(conversationId, userId);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied." });
        }

        const messages = await Message.findAll({
            where: { conversationId },
            attributes: await getMessageAttributes(),
            include: [
                {
                    model: User,
                    as: "sender",
                    attributes: ["id", "email", "role", "isVerified"],
                },
            ],
            order: [["sentAt", "ASC"]],
        });

        const profileMap = await getUserProfileMap(messages.map((message) => message.sender?.id));
        const normalizedMessages = messages.map((message) => ({
            ...message.toJSON(),
            sender: toUserWithDisplayName(message.sender, profileMap),
        }));

        return res.json({ conversationId, messages: normalizedMessages });
    } catch (err) {
        console.error("getConversationMessages error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const userId = req.user.id;
        const body = cleanBody(req.body.body);
        const providedContextId = cleanBody(req.body.contextId);
        const contextType = cleanBody(req.body.contextType);
        const contextRelatedId = cleanBody(req.body.contextRelatedId);
        const contextMetadata =
            req.body.contextMetadata && typeof req.body.contextMetadata === "object"
                ? req.body.contextMetadata
                : {};
        const allowedContextTypes = new Set([
            "appointment",
            "symptom",
            "medication",
            "caregiver_invite",
            "care_concern",
            "diagnosis",
            "medical_note",
        ]);

        if (!body) {
            return res.status(400).json({ message: "Message body is required." });
        }

        if (contextType && !allowedContextTypes.has(contextType)) {
            return res.status(400).json({ message: "Invalid contextType." });
        }

        const isMember = await ensureConversationMember(conversationId, userId);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied." });
        }

        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found." });
        }

        let contextId = null;
        if (providedContextId) {
            contextId = providedContextId;
        } else if (contextType && contextRelatedId) {
            try {
                const context = await CommunicationContext.create({
                    type: contextType,
                    relatedId: contextRelatedId,
                    metadata: contextMetadata,
                });
                contextId = context.id;
            } catch (contextErr) {
                console.warn("sendMessage context attachment skipped:", contextErr.message);
                contextId = null;
            }
        }

        const messagePayload = {
            conversationId,
            senderId: userId,
            body,
            sentAt: new Date(),
        };

        if (contextId && (await supportsMessageContextColumn())) {
            messagePayload.contextId = contextId;
        }

        const message = await Message.create(messagePayload, {
            fields: Object.keys(messagePayload),
        });

        await conversation.update({ updatedAt: new Date() });

        const fullMessage = await Message.findByPk(message.id, {
            attributes: await getMessageAttributes(),
            include: [
                {
                    model: User,
                    as: "sender",
                    attributes: ["id", "email", "role", "isVerified"],
                },
            ],
        });

        const profileMap = await getUserProfileMap([fullMessage?.sender?.id]);
        const normalizedMessage = fullMessage
            ? {
                ...fullMessage.toJSON(),
                sender: toUserWithDisplayName(fullMessage.sender, profileMap),
            }
            : null;

        return res.status(201).json({
            message: "Message sent successfully.",
            data: normalizedMessage,
        });
    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};

export const deleteConversation = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const userId = req.user.id;

        const isMember = await ensureConversationMember(conversationId, userId);
        if (!isMember) {
            return res.status(403).json({ message: "Access denied." });
        }

        const conversation = await Conversation.findByPk(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Conversation not found." });
        }

        await conversation.destroy();
        return res.json({ message: "Conversation deleted." });
    } catch (err) {
        console.error("deleteConversation error:", err);
        return res.status(500).json({ message: "Server error." });
    }
};
