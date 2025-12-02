/**
 * Routing Configuration (Legacy compatibility + New routing)
 * 
 * This file provides backward compatibility and exports the new routing system.
 */

import { resolveStorageProfile, validateRoutingRules } from './routingRules.js';
import { getStorageProfile } from './storageProfiles.js';

/**
 * Get destinations for a log entry (new routing system)
 * @param {Object} logEntry - Log entry with kind, category, level
 * @returns {string[]} Array of destination names ('elasticsearch', 'mongodb', etc.)
 */
export function getDestinations(logEntry) {
    // Resolve storage profile
    const profileKey = resolveStorageProfile(logEntry);
    const profile = getStorageProfile(profileKey);

    if (!profile) {
        console.warn(`[Routing] Profile '${profileKey}' not found, using fallback`);
        // Fallback to HOT_SEARCH
        const fallback = getStorageProfile('HOT_SEARCH');
        return fallback ? fallback.destinations : ['elasticsearch'];
    }

    return profile.destinations;
}

/**
 * Get storage profile for a log entry
 * @param {Object} logEntry - Log entry
 * @returns {Object|null} Storage profile or null
 */
export function getStorageProfileForLog(logEntry) {
    const profileKey = resolveStorageProfile(logEntry);
    return getStorageProfile(profileKey);
}

/**
 * Legacy function for backward compatibility
 * Maps old category-based routing to new system
 * @param {string} category - Category name
 * @returns {string[]} Array of destinations
 * @deprecated Use getDestinations(logEntry) instead
 */
export function getDestinationsByCategory(category) {
    // Map old categories to new format
    const kindMap = {
        'BUSINESS': 'BUSINESS',
        'ANALYTICS': 'ANALYTICS',
        'SYSTEM': 'SYSTEM',
        'DEBUG': 'SYSTEM',
        'ERROR': 'SYSTEM',
        'INFO': 'SYSTEM'
    };

    const kind = kindMap[category?.toUpperCase()] || 'SYSTEM';
    const level = ['DEBUG', 'ERROR', 'INFO'].includes(category?.toUpperCase()) 
        ? category.toUpperCase() 
        : 'INFO';

    return getDestinations({ kind, category, level });
}

// Export routing rules for direct access if needed
export { resolveStorageProfile, validateRoutingRules } from './routingRules.js';
export { STORAGE_PROFILES, getStorageProfile } from './storageProfiles.js';
