import Availability from '../models/Availability.js';
import { Op } from 'sequelize';

export const createAvailability = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { type, dayOfWeek, specificDate, startTime, endTime, reason } = req.body;

    if (!type || !startTime || !endTime) {
      return res.status(400).json({ message: 'type, startTime, and endTime are required.' });
    }

    // Basic validation
    if (type === 'workHours' && (dayOfWeek === undefined || dayOfWeek === null)) {
      return res.status(400).json({ message: 'dayOfWeek is required for workHours type.' });
    }
    if ((type === 'break' || type === 'blocked') && !specificDate) {
      return res.status(400).json({ message: 'specificDate is required for break/blocked type.' });
    }

    const availability = await Availability.create({
      doctorId,
      type,
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      reason
    });

    return res.status(201).json(availability);
  } catch (error) {
    console.error('Error creating availability:', error);
    return res.status(500).json({ message: 'Failed to create availability.' });
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
    const { type, dayOfWeek, specificDate, startTime, endTime, reason } = req.body;

    const availability = await Availability.findOne({
      where: { id, doctorId }
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability entry not found.' });
    }

    await availability.update({
      type: type || availability.type,
      dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : availability.dayOfWeek,
      specificDate: specificDate || availability.specificDate,
      startTime: startTime || availability.startTime,
      endTime: endTime || availability.endTime,
      reason: reason !== undefined ? reason : availability.reason
    });

    return res.json(availability);
  } catch (error) {
    console.error('Error updating availability:', error);
    return res.status(500).json({ message: 'Failed to update availability.' });
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
