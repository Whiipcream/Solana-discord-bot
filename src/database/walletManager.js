const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Fetches all tracked wallet addresses from the database.
 * @returns {Promise<string[]>} Array of wallet addresses.
 */
async function getTrackedWallets() {
  try {
    const res = await pool.query('SELECT address FROM tracked_wallets');
    return res.rows.map(row => row.address);
  } catch (err) {
    console.error('Error fetching tracked wallets:', err);
    return [];
  }
}

module.exports = {
  pool,
  getTrackedWallets,
};
