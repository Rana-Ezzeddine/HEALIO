import Availability from '../models/Availability.js';
import { Op } from 'sequelize';

async function ensureAvailabilitySchemaReady() {
  const queryInterface = Availability.sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(Availability.getTableName());

  if (!table.effectiveFrom) {
    await queryInterface.addColumn(Availability.getTableName(), 'effectiveFrom', {
      type: Availability.sequelize.Sequelize.DATEONLY,
      allowNull: true,
    });
  }

  if (!table.effectiveUntil) {
    await queryInterface.addColumn(Availability.getTableName(), 'effectiveUntil', {
      type: Availability.sequelize.Sequelize.DATEONLY,
      allowNull: true,
    });
  }
  if (!table.workHoursScope) {
    await queryInterface.addColumn(Availability.getTableName(), 'workHoursScope', {
      type: Availability.sequelize.Sequelize.ENUM('default', 'override'),
      allowNull: false,
      defaultValue: 'default',
    });
  }
}

async function pruneExpiredAvailability(doctorId) {
  const today = new Date().toISOString().slice(0, 10);
  await Availability.destroy({
    where: {
      doctorId,
      type: 'workHours',
      effectiveUntil: { [Op.lt]: today },
    },
  });
}

function normalizeAvailabilityPayload(body = {}) {
  const cleanType = String(body.type || '').trim();
  const cleanStartTime = String(body.startTime || '').trim();
  const cleanEndTime = String(body.endTime || '').trim();
  const cleanReason = body.reason ? String(body.reason).trim() : null;
  const cleanSpecificDate = body.specificDate ? String(body.specificDate).trim() : null;
  const cleanEffectiveFrom = body.effectiveFrom ? String(body.effectiveFrom).trim() : null;
  const cleanEffectiveUntil = body.effectiveUntil ? String(body.effectiveUntil).trim() : null;
  const hasDayOfWeek = body.dayOfWeek !== undefined && body.dayOfWeek !== null && String(body.dayOfWeek).trim() !== '';
  const cleanDayOfWeek = hasDayOfWeek ? Number(body.dayOfWeek) : null;

  return {
    type: cleanType,
    dayOfWeek: cleanDayOfWeek,
    specificDate: cleanSpecificDate,
    effectiveFrom: cleanEffectiveFrom,
    effectiveUntil: cleanEffectiveUntil,
    startTime: cleanStartTime,
    endTime: cleanEndTime,
    reason: cleanReason,
  };
}

function validateAvailabilityPayload(payload) {
  const { type, dayOfWeek, specificDate, startTime, endTime, effectiveFrom, effectiveUntil } = payload;

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
    if (effectiveFrom && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      return 'effectiveFrom must be in YYYY-MM-DD format.';
    }
    if (effectiveUntil && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveUntil)) {
      return 'effectiveUntil must be in YYYY-MM-DD format.';
    }
    if (effectiveFrom && effectiveUntil && effectiveUntil < effectiveFrom) {
      return 'effectiveUntil must be on or after effectiveFrom.';
    }
  }

  if ((type === 'break' || type === 'blocked') && !specificDate) {
    return 'specificDate is required for break/blocked type.';
  }

  return null;
}

function timeRangesOverlap(startA, endA, startB, endB) {
  return String(startA) < String(endB) && String(endA) > String(startB);
}

function dateRangesOverlap(startA, endA, startB, endB) {
  const min = "0000-01-01";
  const max = "9999-12-31";
  const aStart = startA || min;
  const aEnd = endA || max;
  const bStart = startB || min;
  const bEnd = endB || max;
  return aStart <= bEnd && bStart <= aEnd;
}

async function ensureNoOverlappingWorkHours({
  doctorId,
  payload,
  excludeId = null,
}) {
  if (payload.type !== "workHours") return;

  const candidates = await Availability.findAll({
    where: {
      doctorId,
      type: "workHours",
      dayOfWeek: payload.dayOfWeek,
    },
  });

  const overlap = candidates.find((entry) => {
    if (excludeId && entry.id === excludeId) return false;
    const isDateOverlap = dateRangesOverlap(
      payload.effectiveFrom,
      payload.effectiveUntil,
      entry.effectiveFrom,
      entry.effectiveUntil
    );
    if (!isDateOverlap) return false;
    // Strict schedule rule: one weekday can have only one active date-range entry at a time,
    // regardless of time window.
    return true;
  });

  if (overlap) {
    const err = new Error("Overlapping weekday schedule exists for the same day/date range.");
    err.status = 409;
    throw err;
  }
}

export const createAvailability = async (req, res) => {
  try {
    await ensureAvailabilitySchemaReady();
    const doctorId = req.user.id;
    const payload = normalizeAvailabilityPayload(req.body);
    const validationError = validateAvailabilityPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await ensureNoOverlappingWorkHours({ doctorId, payload });

    const availability = await Availability.create({
      doctorId,
      type: payload.type,
      dayOfWeek: payload.type === 'workHours' ? payload.dayOfWeek : null,
      workHoursScope: "default",
      specificDate: payload.type === 'workHours' ? null : payload.specificDate,
      effectiveFrom: payload.type === 'workHours' ? payload.effectiveFrom : null,
      effectiveUntil: payload.type === 'workHours' ? payload.effectiveUntil : null,
      startTime: payload.startTime,
      endTime: payload.endTime,
      reason: payload.reason,
    });

    return res.status(201).json(availability);
  } catch (error) {
    console.error('Error creating availability:', error);
    return res.status(error?.status || 500).json({ message: error?.message || 'Failed to create availability.' });
  }
};

export const getMyAvailability = async (req, res) => {
  try {
    await ensureAvailabilitySchemaReady();
    const doctorId = req.user.id;
    await pruneExpiredAvailability(doctorId);
    const availabilities = await Availability.findAll({
      where: { doctorId },
      order: [['type', 'ASC'], ['dayOfWeek', 'ASC'], ['effectiveFrom', 'ASC'], ['specificDate', 'ASC'], ['startTime', 'ASC']]
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
    await ensureAvailabilitySchemaReady();
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
      effectiveFrom: req.body?.effectiveFrom ?? availability.effectiveFrom,
      effectiveUntil: req.body?.effectiveUntil ?? availability.effectiveUntil,
      startTime: req.body?.startTime ?? availability.startTime,
      endTime: req.body?.endTime ?? availability.endTime,
      reason: req.body?.reason ?? availability.reason,
    });
    const validationError = validateAvailabilityPayload(payload);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    await ensureNoOverlappingWorkHours({ doctorId, payload, excludeId: availability.id });

    await availability.update({
      type: payload.type,
      dayOfWeek: payload.type === 'workHours' ? payload.dayOfWeek : null,
      workHoursScope: "default",
      specificDate: payload.type === 'workHours' ? null : payload.specificDate,
      effectiveFrom: payload.type === 'workHours' ? payload.effectiveFrom : null,
      effectiveUntil: payload.type === 'workHours' ? payload.effectiveUntil : null,
      startTime: payload.startTime,
      endTime: payload.endTime,
      reason: payload.reason,
    });

    return res.json(availability);
  } catch (error) {
    console.error('Error updating availability:', error);
    return res.status(error?.status || 500).json({ message: error?.message || 'Failed to update availability.' });
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
