const { Pool } = require('pg')

const pool = new Pool({
    user: 'insighthub_tnz4_user',
    host: 'dpg-d7o0dp6gvqtc73b5evu0-a.oregon-postgres.render.com',
    password: 'HC3vIQiKA3bAgfzFhHnW3sCM9uRxMj6L',
    port: 5432,
    database: 'insighthub_tnz4',
    ssl: true
})

pool.on('connect', () => {
    console.log('Database connected successfully');
})

pool.on('error', (err) => {
    console.error('Error on Database:', err);
})

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection failed', err.message);
    } else {
        console.log('Database connection successful');
    }
});

module.exports = pool;