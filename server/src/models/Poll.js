// server/src/models/Poll.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * One option in a poll = one vendor (via their EventApplication).
 */
const pollOptionSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "EventApplication",
      required: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User", // owner of the application
      required: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    boothNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

/**
 * One vote = one user choosing one option.
 * We enforce "one vote per user per poll" in the controller.
 */
const pollVoteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    optionId: {
      type: Schema.Types.ObjectId,
      required: true, // references poll.options._id
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const pollSchema = new Schema(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Vendors in the poll
    options: {
      type: [pollOptionSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length >= 2;
        },
        message: "Poll must have at least two vendor options.",
      },
    },

    // Raw votes (we’ll aggregate counts when returning)
    votes: {
      type: [pollVoteSchema],
      default: [],
    },

    // Allow closing a poll later if needed
    isOpen: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Helper to convert a Poll document into a JSON object with vote counts
 * and the current user's chosen option.
 */
pollSchema.methods.toResponse = function toResponse(userId) {
  const doc = this.toObject({ virtuals: false });

  const counts = {};
  let myOptionId = null;

  (doc.votes || []).forEach((v) => {
    const key = String(v.optionId);
    counts[key] = (counts[key] || 0) + 1;

    if (userId && String(v.userId) === String(userId)) {
      myOptionId = key;
    }
  });

  const optionsWithCounts = (doc.options || []).map((opt) => {
    const key = String(opt._id);
    return {
      ...opt,
      voteCount: counts[key] || 0,
      isMyChoice: myOptionId === key,
    };
  });

  return {
    _id: doc._id,
    eventId: doc.eventId,
    title: doc.title,
    description: doc.description,
    createdBy: doc.createdBy,
    isOpen: doc.isOpen,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    options: optionsWithCounts,
    totalVotes: (doc.votes || []).length,
  };
};

export const Poll = mongoose.model("Poll", pollSchema);
export default Poll;
