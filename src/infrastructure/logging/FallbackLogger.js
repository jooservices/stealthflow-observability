import fs from 'fs/promises';
import path from 'path';

export class FallbackLogger {
    constructor(options = {}) {
        this.logDir = options.logDir || '/var/log/observability/fallback';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.retentionDays = options.retentionDays || 7;
        this.currentFile = null;
        this.currentFileSize = 0;
    }

    /**
     * Log entry to fallback file storage
     * @param {Object} entry - Log entry
     */
    async logEntry(entry) {
        try {
            // Create date-based directory
            const date = new Date();
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const dateDir = path.join(this.logDir, dateStr);

            await fs.mkdir(dateDir, { recursive: true });

            // Rotate file if needed
            if (this.currentFileSize >= this.maxFileSize || !this.currentFile) {
                await this.rotateFile(dateDir);
            }

            // Write log entry (JSONL format)
            const logLine = JSON.stringify(entry) + '\n';
            await fs.appendFile(this.currentFile, logLine);
            this.currentFileSize += Buffer.byteLength(logLine);

            // Cleanup old logs (async, don't wait)
            this.cleanupOldLogs().catch(() => { });

        } catch (error) {
            // Last resort: console
            console.error('[FallbackLogger] Failed to write:', error.message);
            console.error('[FallbackLogger] Entry:', JSON.stringify(entry));
        }
    }

    /**
     * Rotate to new file
     */
    async rotateFile(dateDir) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        this.currentFile = path.join(dateDir, `logs-${timestamp}.jsonl`);
        this.currentFileSize = 0;
        console.log('[FallbackLogger] Rotated to:', this.currentFile);
    }

    /**
     * Cleanup old log directories
     */
    async cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            const entries = await fs.readdir(this.logDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const dirDate = new Date(entry.name);
                    if (dirDate < cutoffDate) {
                        const dirPath = path.join(this.logDir, entry.name);
                        await fs.rm(dirPath, { recursive: true });
                        console.log('[FallbackLogger] Cleaned up old logs:', entry.name);
                    }
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}
