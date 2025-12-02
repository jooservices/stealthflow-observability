/**
 * Storage Profiles Configuration
 * 
 * Defines storage destinations, TTL, and indexing strategies for different log profiles.
 * This is the ONLY place that mentions 'elasticsearch' or 'mongodb'.
 */

export const STORAGE_PROFILES = {
    HOT_SEARCH: {
        destinations: ['elasticsearch'],
        ttlDays: 30,
        indexPrefix: 'logs-hot'      // e.g., logs-hot-2025.12.02
    },

    LONG_TERM: {
        destinations: ['mongodb'],
        ttlDays: 365,
        collection: 'logs_long_term'
    },

    AUDIT: {
        destinations: ['mongodb'],
        ttlDays: 3650,  // 10 years
        collection: 'logs_audit'
    },

    DEBUG_SHORT: {
        destinations: ['elasticsearch'],
        ttlDays: 7,
        indexPrefix: 'logs-debug'
    },

    CRITICAL_DUAL: {
        destinations: ['elasticsearch', 'mongodb'],
        ttlDays: 90,
        indexPrefix: 'logs-critical',
        collection: 'logs_critical'
    },

    DLQ: {
        destinations: ['mongodb'],
        ttlDays: 90,
        collection: 'logs_dlq'
    }
};

/**
 * Get storage profile by key
 * @param {string} profileKey 
 * @returns {Object|null} Storage profile or null if not found
 */
export function getStorageProfile(profileKey) {
    return STORAGE_PROFILES[profileKey] || null;
}

/**
 * Validate that all referenced profiles exist
 * @param {string[]} profileKeys 
 * @returns {boolean}
 */
export function validateProfiles(profileKeys) {
    return profileKeys.every(key => STORAGE_PROFILES.hasOwnProperty(key));
}
