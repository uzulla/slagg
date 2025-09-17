import { Logger, logger } from './src/utils/Logger.js';

console.log('Testing Logger class...');

// Test the class instance
const testLogger = new Logger();
testLogger.info('This is an info message');
testLogger.warn('This is a warning message');
testLogger.error('This is an error message');

console.log('\nTesting singleton logger...');

// Test the singleton
logger.info('Singleton info message');
logger.warn('Singleton warning message');
logger.error('Singleton error message');

console.log('\nLogger test completed.');
