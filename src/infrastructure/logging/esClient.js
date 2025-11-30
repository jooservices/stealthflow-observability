import { Client } from '@elastic/elasticsearch';

let esClient = null;

/**
 * Get singleton Elasticsearch client
 * @returns {Client} Elasticsearch client instance
 */
export function getElasticsearchClient() {
    if (!esClient) {
        const config = {
            node: process.env.ELASTICSEARCH_URL || 'http://192.168.1.13:9201',

            // Connection settings
            maxRetries: 3,
            requestTimeout: 30000,
            sniffOnStart: false,

            // Compression
            compression: 'gzip',

            // TLS (if needed)
            ssl: {
                rejectUnauthorized: process.env.ELASTICSEARCH_TLS_VERIFY === 'true'
            }
        };

        // Add auth if provided
        if (process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD) {
            config.auth = {
                username: process.env.ELASTICSEARCH_USERNAME,
                password: process.env.ELASTICSEARCH_PASSWORD
            };
        } else if (process.env.ELASTICSEARCH_API_KEY) {
            config.auth = {
                apiKey: process.env.ELASTICSEARCH_API_KEY
            };
        }

        esClient = new Client(config);

        console.log('[Elasticsearch] Client initialized');
    }

    return esClient;
}

/**
 * Close Elasticsearch connection
 */
export async function closeElasticsearchClient() {
    if (esClient) {
        await esClient.close();
        esClient = null;
        console.log('[Elasticsearch] Connection closed gracefully');
    }
}

/**
 * Check if Elasticsearch is available
 * @returns {Promise<boolean>}
 */
export async function checkElasticsearchHealth() {
    try {
        const client = getElasticsearchClient();
        const health = await client.cluster.health();
        return health.status !== 'red';
    } catch (error) {
        console.error('[Elasticsearch] Health check failed:', error.message);
        return false;
    }
}
