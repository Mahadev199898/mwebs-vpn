const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255),
      access_key TEXT NOT NULL,
      plan_name VARCHAR(100),
      plan_duration VARCHAR(50),
      server_location VARCHAR(100),
      start_date TIMESTAMPTZ DEFAULT NOW(),
      end_date TIMESTAMPTZ,
      payment_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active'
    );
  `;
  try {
    await pool.query(queryText);
    console.log('"subscriptions" table is ready.');
  } catch (err) {
    console.error('FATAL: Error creating subscriptions table:', err);
    process.exit(1);
  }
};

createTable();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
