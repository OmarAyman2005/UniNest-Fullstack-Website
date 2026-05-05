import mongoose from 'mongoose';

const WorkshopRequestSchema = new mongoose.Schema({
  workshop: { type: mongoose.Schema.Types.ObjectId, ref: 'workshop', required: true, index: true },
  status: {
    type: String,
    enum: ['accepted', 'rejected', 'pending', 'edit_required'],
    default: 'pending',
    required: true,
    index: true,
  },
  comment: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
},
{
  timestamps: { createdAt: 'createdAt', updatedAt: 'modifiedAt' }
});

WorkshopRequestSchema.pre('validate', function (next) {
  if (!mongoose.Types.ObjectId.isValid(String(this.workshop))) {
    return next(new Error('Invalid workshop id'));
  }
  next();
});

export default mongoose.model('WorkshopRequest', WorkshopRequestSchema);