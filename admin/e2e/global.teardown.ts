/**
 * Global teardown for Playwright E2E tests
 * Runs once after all test suites complete
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('\n=== Global Teardown Starting ===\n');

  try {
    // 1. Clean up test database (if using a real backend)
    if (process.env.CLEANUP_DATABASE === 'true') {
      console.log('Cleaning up test database...');
      await cleanupTestDatabase();
      console.log('Database cleaned up.');
    }

    // 2. Clean up authentication state files
    console.log('Cleaning up auth state files...');
    await cleanupAuthStateFiles();
    console.log('Auth state files cleaned up.');

    // 3. Clean up any temporary files created during tests
    console.log('Cleaning up temporary files...');
    await cleanupTempFiles();
    console.log('Temporary files cleaned up.');

    // 4. Generate test summary report
    console.log('Generating test summary...');
    await generateTestSummary(config);
    console.log('Test summary generated.');

    console.log('\n=== Global Teardown Complete ===\n');

  } catch (error) {
    console.error('Global teardown encountered an error:', error);
    // Don't throw - we want tests to complete even if teardown has issues
  }
}

/**
 * Clean up test data from the database
 */
async function cleanupTestDatabase() {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080/api/v1';

  // In a real implementation, this would call your API to clean up test data
  // await fetch(`${apiBaseUrl}/test/cleanup`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ prefix: 'test-' }),
  // });

  // For now, just clear the environment variable
  delete process.env.SEED_DATA;
}

/**
 * Clean up stored authentication state files
 */
async function cleanupAuthStateFiles() {
  const authDir = 'e2e/.auth';

  try {
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        const filePath = path.join(authDir, file);
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.warn('Warning: Could not clean up auth files:', error);
  }
}

/**
 * Clean up any temporary files created during tests
 */
async function cleanupTempFiles() {
  const tempDirs = [
    'e2e/.temp',
    'e2e/downloads',
  ];

  for (const dir of tempDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up ${dir}:`, error);
    }
  }
}

/**
 * Generate a summary of the test run
 */
async function generateTestSummary(config: FullConfig) {
  const resultsPath = 'test-results/results.json';

  if (!fs.existsSync(resultsPath)) {
    console.log('No test results file found.');
    return;
  }

  try {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.CI ? 'CI' : 'local',
      baseURL: config.projects[0].use?.baseURL,
      stats: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      },
      failedTests: [] as string[],
    };

    // Parse results to generate summary
    if (results.suites) {
      for (const suite of results.suites) {
        processTestSuite(suite, summary);
      }
    }

    // Calculate pass rate
    const passRate = summary.stats.total > 0
      ? ((summary.stats.passed / summary.stats.total) * 100).toFixed(2)
      : '0';

    console.log('\n--- Test Run Summary ---');
    console.log(`Total Tests: ${summary.stats.total}`);
    console.log(`Passed: ${summary.stats.passed}`);
    console.log(`Failed: ${summary.stats.failed}`);
    console.log(`Skipped: ${summary.stats.skipped}`);
    console.log(`Pass Rate: ${passRate}%`);
    console.log(`Duration: ${(summary.stats.duration / 1000).toFixed(2)}s`);

    if (summary.failedTests.length > 0) {
      console.log('\nFailed Tests:');
      for (const test of summary.failedTests) {
        console.log(`  - ${test}`);
      }
    }

    // Write summary to file
    const summaryPath = 'test-results/summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\nSummary written to: ${summaryPath}`);

  } catch (error) {
    console.warn('Warning: Could not generate test summary:', error);
  }
}

/**
 * Process a test suite and its nested suites/tests
 */
function processTestSuite(suite: any, summary: any) {
  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests || []) {
        summary.stats.total++;
        summary.stats.duration += test.results?.[0]?.duration || 0;

        const status = test.results?.[0]?.status;
        if (status === 'passed' || status === 'expected') {
          summary.stats.passed++;
        } else if (status === 'failed' || status === 'unexpected') {
          summary.stats.failed++;
          summary.failedTests.push(`${suite.title} > ${spec.title}`);
        } else if (status === 'skipped') {
          summary.stats.skipped++;
        }
      }
    }
  }

  // Process nested suites
  if (suite.suites) {
    for (const nestedSuite of suite.suites) {
      processTestSuite(nestedSuite, summary);
    }
  }
}

export default globalTeardown;
