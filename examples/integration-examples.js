/**
 * Example: How to use Observability in your project
 */

import logger from '../client/observability.js';

// =============================================================================
// Example 1: Simple Logging
// =============================================================================

async function example1_simpleLogging() {
    console.log('\n=== Example 1: Simple Logging ===');

    await logger.system('app_started', {
        version: '1.0.0',
        environment: 'production'
    });

    console.log('✅ Logged: app_started');
}

// =============================================================================
// Example 2: Workflow Tracking
// =============================================================================

async function example2_workflowTracking() {
    console.log('\n=== Example 2: Workflow Tracking ===');

    const workflowId = `order-${Date.now()}`;

    // Step 1
    await logger.workflow(workflowId, 'order_created', {
        orderId: 'ORD-001',
        amount: 100,
        items: 3
    });

    // Simulate processing
    await new Promise(r => setTimeout(r, 100));

    // Step 2
    await logger.workflow(workflowId, 'payment_processed', {
        orderId: 'ORD-001',
        paymentId: 'PAY-001',
        method: 'credit_card'
    });

    await new Promise(r => setTimeout(r, 100));

    // Step 3
    await logger.workflow(workflowId, 'order_shipped', {
        orderId: 'ORD-001',
        trackingNumber: 'TRACK-123',
        carrier: 'FedEx'
    });

    console.log(`✅ Workflow tracked: ${workflowId}`);
    console.log('   View in Kibana: workflowId: "' + workflowId + '"');
}

// =============================================================================
// Example 3: Error Logging
// =============================================================================

async function example3_errorLogging() {
    console.log('\n=== Example 3: Error Logging ===');

    try {
        // Simulate error
        throw new Error('Database connection failed');
    } catch (error) {
        await logger.error(error, {
            operation: 'database_connect',
            host: 'db.example.com',
            port: 5432
        });

        console.log('✅ Error logged:', error.message);
    }
}

// =============================================================================
// Example 4: Authentication Logging
// =============================================================================

async function example4_authLogging() {
    console.log('\n=== Example 4: Authentication ===');

    const userId = '123';

    // Login
    await logger.auth('user_login', {
        userId,
        method: 'oauth',
        provider: 'google'
    });

    console.log('✅ Logged: user_login');

    // Actions
    await logger.log('SYSTEM', 'user_action', {
        userId,
        action: 'view_dashboard'
    });

    // Logout
    await logger.auth('user_logout', {
        userId,
        sessionDuration: 3600
    });

    console.log('✅ Logged: user_logout');
}

// =============================================================================
// Example 5: Batch Logging
// =============================================================================

async function example5_batchLogging() {
    console.log('\n=== Example 5: Batch Logging ===');

    const logs = [
        {
            category: 'SYSTEM',
            operation: 'task_1',
            metadata: { result: 'success' }
        },
        {
            category: 'SYSTEM',
            operation: 'task_2',
            metadata: { result: 'success' }
        },
        {
            category: 'SYSTEM',
            operation: 'task_3',
            metadata: { result: 'success' }
        }
    ];

    const result = await logger.logBatch(logs);

    console.log('✅ Batch logged:', result);
}

// =============================================================================
// Example 6: E-commerce Checkout Flow
// =============================================================================

async function example6_ecommerceCheckout() {
    console.log('\n=== Example 6: E-commerce Checkout ===');

    const workflowId = `checkout-${Date.now()}`;
    const userId = 'user-456';

    try {
        // Start checkout
        await logger.workflow(workflowId, 'checkout_started', {
            userId,
            cartTotal: 299.99,
            itemCount: 5
        });

        // Validate cart
        await logger.workflow(workflowId, 'cart_validated', {
            userId,
            validItems: 5,
            invalidItems: 0
        });

        // Apply discount
        await logger.workflow(workflowId, 'discount_applied', {
            userId,
            code: 'SAVE20',
            discountAmount: 60
        });

        // Process payment
        await logger.workflow(workflowId, 'payment_processing', {
            userId,
            amount: 239.99,
            method: 'credit_card'
        });

        await new Promise(r => setTimeout(r, 200));

        await logger.workflow(workflowId, 'payment_success', {
            userId,
            transactionId: 'TXN-789',
            amount: 239.99
        });

        // Create order
        await logger.workflow(workflowId, 'order_created', {
            userId,
            orderId: 'ORD-002',
            amount: 239.99
        });

        // Send confirmation
        await logger.workflow(workflowId, 'email_sent', {
            userId,
            type: 'order_confirmation',
            to: 'user@example.com'
        });

        //Complete
        await logger.workflow(workflowId, 'checkout_completed', {
            userId,
            orderId: 'ORD-002',
            totalDuration: 500
        });

        console.log(`✅ Checkout completed: ${workflowId}`);
        console.log('   Query in Kibana: workflowId: "' + workflowId + '"');

    } catch (error) {
        await logger.workflow(workflowId, 'checkout_failed', {
            userId,
            error: error.message
        });

        await logger.error(error, {
            workflowId,
            operation: 'checkout',
            userId
        });

        console.error('❌ Checkout failed:', error);
    }
}

// =============================================================================
// Run All Examples
// =============================================================================

async function runAll() {
    console.log('='.repeat(60));
    console.log('  Observability Integration Examples');
    console.log('='.repeat(60));

    await example1_simpleLogging();
    await example2_workflowTracking();
    await example3_errorLogging();
    await example4_authLogging();
    await example5_batchLogging();
    await example6_ecommerceCheckout();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All examples completed!');
    console.log('='.repeat(60));
    console.log('\nView logs in Kibana: http://192.168.1.13:5602');
    console.log('API Health: http://localhost:3100/health');
    console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAll().catch(console.error);
}

export {
    example1_simpleLogging,
    example2_workflowTracking,
    example3_errorLogging,
    example4_authLogging,
    example5_batchLogging,
    example6_ecommerceCheckout
};
