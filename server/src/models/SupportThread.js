import mongoose from 'mongoose';
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String },
    body: { type: String, required: true },
    attachments: { type: [{ url: String, key: String, mime: String, size: Number }], default: [] },
  },
  { timestamps: true }
);

const SupportThreadSchema = new Schema(
  {
    subject: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    messages: { type: [MessageSchema], default: [] },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

SupportThreadSchema.index({ user: 1, status: 1 });

export default mongoose.models.SupportThread || mongoose.model('SupportThread', SupportThreadSchema);
