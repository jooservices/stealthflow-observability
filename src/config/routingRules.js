/**
 * Routing Rules Configuration
 * 
 * Determines which storage profile to use based on log attributes.
 * This layer does NOT know about 'elasticsearch' or 'mongodb' - only profile names.
 * 
 * Priority order:
 * 1. Overrides (highest priority)
 * 2. By Category (pattern matching)
 * 3. By Kind + Level
 * 4. Fallback
 */

import { STORAGE_PROFILES } from './storageProfiles.js';

export const ROUTING_RULES = {
    // 1. Overrides – highest priority
    overrides: [
        { category: 'dlq.*', profile: 'DLQ' },
        { category: 'audit.*', profile: 'AUDIT' }
    ],

    // 2. By category pattern (domain-based routing)
    byCategory: [
        { pattern: 'facebook.*', profile: 'HOT_SEARCH' },
        { pattern: 'flickr.*', profile: 'HOT_SEARCH' },
        { pattern: 'stealthflow.*', profile: 'HOT_SEARCH' },
        { pattern: 'business.*', profile: 'LONG_TERM' },
        { pattern: 'analytics.*', profile: 'LONG_TERM' }
        // Can add: twitter.*, payment.*, etc.
    ],

    // 3. By kind + level
    byKindAndLevel: {
        BUSINESS: {
            ERROR: 'CRITICAL_DUAL',
            WARN: 'CRITICAL_DUAL',
            INFO: 'LONG_TERM',
            DEBUG: 'DEBUG_SHORT',
            TRACE: 'DEBUG_SHORT',
            FATAL: 'CRITICAL_DUAL'
        },
        SYSTEM: {
            ERROR: 'HOT_SEARCH',
            WARN: 'HOT_SEARCH',
            INFO: 'HOT_SEARCH',
            DEBUG: 'DEBUG_SHORT',
            TRACE: 'DEBUG_SHORT',
            FATAL: 'CRITICAL_DUAL'
        },
        ANALYTICS: {
            '*': 'LONG_TERM'
        },
        AUDIT: {
            '*': 'AUDIT'
        },
        SECURITY: {
            ERROR: 'CRITICAL_DUAL',
            WARN: 'CRITICAL_DUAL',
            INFO: 'HOT_SEARCH',
            DEBUG: 'DEBUG_SHORT',
            TRACE: 'DEBUG_SHORT',
            FATAL: 'CRITICAL_DUAL'
        }
    },

    // 4. Fallback if nothing matches
    fallbackProfile: 'HOT_SEARCH'
};

/**
 * Resolve storage profile for a log entry
 * @param {Object} logEntry - Log entry with kind, category, level
 * @returns {string} Storage profile key
 */
export function resolveStorageProfile(logEntry) {
    const { kind, category, level } = logEntry;

    // 1. Check overrides first (highest priority)
    if (category) {
        for (const override of ROUTING_RULES.overrides) {
            if (matchPattern(category, override.category)) {
                return override.profile;
            }
        }
    }

    // 2. Check by category patterns
    if (category) {
        for (const rule of ROUTING_RULES.byCategory) {
            if (matchPattern(category, rule.pattern)) {
                return rule.profile;
            }
        }
    }

    // 3. Check by kind + level
    if (kind && level) {
        const kindRules = ROUTING_RULES.byKindAndLevel[kind];
        if (kindRules) {
            // Check specific level first
            if (kindRules[level]) {
                return kindRules[level];
            }
            // Check wildcard
            if (kindRules['*']) {
                return kindRules['*'];
            }
        }
    }

    // 4. Fallback
    return ROUTING_RULES.fallbackProfile;
}

/**
 * Match category against pattern (supports wildcard)
 * @param {string} category - Category to match
 * @param {string} pattern - Pattern (e.g., 'facebook.*', 'dlq.*')
 * @returns {boolean}
 */
function matchPattern(category, pattern) {
    if (!category || !pattern) return false;

    // Convert pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\*/g, '.*');  // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(category);
}

/**
 * Validate routing rules configuration
 * @returns {Object} Validation result
 */
export function validateRoutingRules() {
    const errors = [];
    const profileKeys = new Set();

    // Collect all profile keys used
    ROUTING_RULES.overrides.forEach(rule => profileKeys.add(rule.profile));
    ROUTING_RULES.byCategory.forEach(rule => profileKeys.add(rule.profile));
    Object.values(ROUTING_RULES.byKindAndLevel).forEach(kindRules => {
        Object.values(kindRules).forEach(profile => profileKeys.add(profile));
    });
    profileKeys.add(ROUTING_RULES.fallbackProfile);

    // Check if all profiles exist
    for (const profileKey of profileKeys) {
        if (!STORAGE_PROFILES[profileKey]) {
            errors.push(`Profile '${profileKey}' is referenced but does not exist in STORAGE_PROFILES`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
