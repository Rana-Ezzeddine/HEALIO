import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required'],
      trim: true
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      trim: true
    },
    prescribedBy: {
      type: String,
      trim: true,
      default: null
    },
    startDate: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'medications'
  }
);

// Add indexes for better query performance
medicationSchema.index({ name: 1 });
medicationSchema.index({ prescribedBy: 1 });
medicationSchema.index({ createdAt: -1 });

// Instance method example (optional)
medicationSchema.methods.getFormattedDate = function() {
  if (this.startDate) {
    return this.startDate.toLocaleDateString();
  }
  return null;
};

// Static method example (optional)
medicationSchema.statics.findByDoctor = function(doctorName) {
  return this.find({ prescribedBy: new RegExp(doctorName, 'i') });
};

const Medication = mongoose.model('Medication', medicationSchema);

export default Medication;