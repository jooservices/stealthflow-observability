import mongoose from 'mongoose';

let isConnected = false;

/**
 * Connect to MongoDB
 */
export async function connectMongoDB() {
    if (isConnected) {
        return;
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/observability';

    try {
        await mongoose.connect(uri);
        isConnected = true;
        console.log('[MongoDB] Connected successfully');
    } catch (error) {
        console.error('[MongoDB] Connection error:', error.message);
        throw error;
    }
}

/**
 * Close MongoDB connection
 */
export async function closeMongoDB() {
    if (isConnected) {
        await mongoose.disconnect();
        isConnected = false;
        console.log('[MongoDB] Connection closed');
    }
}

/**
 * Check MongoDB health
 */
export function isMongoDBConnected() {
    return mongoose.connection.readyState === 1;
}
