const { startMonitoring } = require('./src/services/walletMonitor');
const { getTrackedWallets } = require('./src/database/walletManager');

async function test() {
  console.log('Testing Wallet Monitor imports and exports...');
  if (typeof startMonitoring === 'function') {
    console.log('✅ startMonitoring is a function');
  } else {
    console.log('❌ startMonitoring is NOT a function');
    process.exit(1);
  }

  if (typeof getTrackedWallets === 'function') {
    console.log('✅ getTrackedWallets is a function');
  } else {
    console.log('❌ getTrackedWallets is NOT a function');
    process.exit(1);
  }

  console.log('Test completed successfully (basic check).');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
