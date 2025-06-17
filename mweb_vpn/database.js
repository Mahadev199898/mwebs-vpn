const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create table if it doesn't exist
const createTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      access_key TEXT NOT NULL,
      plan VARCHAR(100),
      start_date TIMESTAMPTZ DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      payment_id VARCHAR(255)
    );
  `;
  try {
    await pool.query(queryText);
    console.log('"subscriptions" table is ready.');
  } catch (err) {
    console.error('Error creating subscriptions table:', err);
  }
};

createTable();

module.exports = {
  query: (text, params) => pool.query(text, params),
};