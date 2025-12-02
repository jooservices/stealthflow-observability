import mongoose from 'mongoose';

const BusinessLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    operation: {
        type: String,
        required: true,
        index: true
    },

    // Core Identity
    userId: { type: String, index: true },
    accountUID: { type: String, index: true },

    // Flexible Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Business Metrics (Optional top-level for easy aggregation)
    amount: Number,
    currency: String,
    status: String,

    // System Context
    requestId: String,
    serviceName: String,
    env: String
}, {
    timestamps: true, // adds createdAt, updatedAt
    collection: 'business_logs'
});

// Compound indexes for common queries
BusinessLogSchema.index({ category: 1, timestamp: -1 });
BusinessLogSchema.index({ userId: 1, timestamp: -1 });

export const BusinessLog = mongoose.model('BusinessLog', BusinessLogSchema);
