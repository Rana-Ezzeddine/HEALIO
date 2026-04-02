import Availability from '../models/Availability.js';
import { Op } from 'sequelize';

function normalizeAvailabilityPayload(body = {}) {
  const cleanType = String(body.type || '').trim();
  const cleanStartTime = String(body.startTime || '').trim();
  const cleanEndTime = String(body.endTime || '').trim();
  const cleanReason = body.reason ? String(body.reason).trim() : null;
  const cleanSpecificDate = body.specificDate ? String(body.specificDate).trim() : null;
  const hasDayOfWeek = body.dayOfWeek !== undefined && body.dayOfWeek !== null && String(body.dayOfWeek).trim() !== '';
  const cleanDayOfWeek = hasDayOfWeek ? Number(body.dayOfWeek) : null;

  return {
    type: cleanType,
    dayOfWeek: cleanDayOfWeek,
    specificDate: cleanSpecificDate,
    startTime: cleanStartTime,
    endTime: cleanEndTime,
    reason: cleanReason,
  };
}

function validateAvailabilityPayload(payload) {
  const { type, dayOfWeek, specificDate, startTime, endTime } = payload;

  if (!type || !startTime || !endTime) {
    return 'type, startTime, and endTime are required.';
  }

  if (!['workHours', 'break', 'blocked'].includes(type)) {
    return 'type must be workHours, break, or blocked.';
  }

  if (endTime <= startTime) {
    return 'endTime must be after startTime.';
  }

  if (type === 'workHours') {
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return 'dayOfWeek is required for workHours type.';
    }
  }

  if ((type === 'break' || type === 'blocked') && !specificDate) {
    return 'specificDate is required for break/blocked type.';
  }

  return null;
}

export const createAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const payload = normalizeAvailabilityPayload(req.body);
    const validationError = validateAvailabilityPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const availability = await Availability.create({
      doctorId,
      type: payload.type,
      dayOfWeek: payload.type === 'workHours' ? payload.dayOfWeek : null,
      specificDate: payload.type === 'workHours' ? null : payload.specificDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      reason: payload.reason,
    });

    return res.status(201).json(availability);
  } catch (error) {
    console.error('Error creating availability:', error);
    return res.status(500).json({ message: error?.message || 'Failed to create availability.' });
  }
};

export const getMyAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const availabilities = await Availability.findAll({
      where: { doctorId },
      order: [['type', 'ASC'], ['dayOfWeek', 'ASC'], ['specificDate', 'ASC'], ['startTime', 'ASC']]
    });

    return res.json({
      doctorId,
      count: availabilities.length,
      availabilities
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({ message: 'Failed to fetch availability.' });
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;

    const availability = await Availability.findOne({
      where: { id, doctorId }
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability entry not found.' });
    }

    const payload = normalizeAvailabilityPayload({
      type: req.body?.type ?? availability.type,
      dayOfWeek: req.body?.dayOfWeek ?? availability.dayOfWeek,
      specificDate: req.body?.specificDate ?? availability.specificDate,
      startTime: req.body?.startTime ?? availability.startTime,
      endTime: req.body?.endTime ?? availability.endTime,
      reason: req.body?.reason ?? availability.reason,
    });
    const validationError = validateAvailabilityPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await availability.update({
      type: payload.type,
      dayOfWeek: payload.type === 'workHours' ? payload.dayOfWeek : null,
      specificDate: payload.type === 'workHours' ? null : payload.specificDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      reason: payload.reason,
    });

    return res.json(availability);
  } catch (error) {
    console.error('Error updating availability:', error);
    return res.status(500).json({ message: error?.message || 'Failed to update availability.' });
  }
};

export const deleteAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { id } = req.params;

    const deleted = await Availability.destroy({
      where: { id, doctorId }
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Availability entry not found.' });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting availability:', error);
    return res.status(500).json({ message: 'Failed to delete availability.' });
  }
};
