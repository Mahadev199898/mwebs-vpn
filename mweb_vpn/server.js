require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OUTLINE_SERVERS = {
    "USA": process.env.OUTLINE_API_URL_USA,
    "Germany": process.env.OUTLINE_API_URL_GERMANY,
    "Singapore": process.env.OUTLINE_API_URL_SINGAPORE
};
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

app.post('/api/create-payment', async (req, res) => {
    const { planName, duration, price, email, serverLocation } = req.body;
    if (!planName || !duration || !price || !email || !serverLocation) {
        return res.status(400).json({ message: 'Missing required payment details.' });
    }
    try {
        const orderDescription = `${planName} - ${duration} for ${email} on ${serverLocation}`;
        const nowPaymentsResponse = await fetch("https://api.nowpayments.io/v1/invoice", {
            method: 'POST',
            headers: { 'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                price_amount: price,
                price_currency: "usd",
                order_id: `MWEBS-${Date.now()}`,
                order_description: orderDescription,
                success_url: `${process.env.BASE_URL}/account.html`,
                cancel_url: `${process.env.BASE_URL}/pricing.html`,
                ipn_callback_url: `${process.env.BASE_URL}/api/payment-callback`
            })
        });
        const responseBody = await nowPaymentsResponse.json();
        if (!nowPaymentsResponse.ok) throw new Error(responseBody.message);
        res.status(200).json(responseBody);
    } catch (error) {
        console.error("Error creating payment:", error.message);
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/payment-callback', async (req, res) => {
    const { payment_status, payment_id, order_description } = req.body;
    if (payment_status === 'finished') {
        try {
            const [planDetails, email, serverDetails] = order_description.split(' for ');
            const [planName, duration] = planDetails.split(' - ');
            const serverLocation = serverDetails.split(' on ')[1];
            const outlineApiUrl = OUTLINE_SERVERS[serverLocation];
            if (!outlineApiUrl) throw new Error(`Invalid server location: ${serverLocation}`);
            const createKeyResponse = await fetch(`${outlineApiUrl}/access-keys`, { method: 'POST' });
            if (!createKeyResponse.ok) throw new Error('Failed to create key on Outline server.');
            const keyData = await createKeyResponse.json();
            await fetch(`${outlineApiUrl}/access-keys/${keyData.id}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `${email}-${planName}` })
            });
            const endDate = new Date();
            if (duration === 'Monthly') endDate.setMonth(endDate.getMonth() + 1);
            else if (duration === '6 Months') endDate.setMonth(endDate.getMonth() + 6);
            else if (duration === 'Yearly') endDate.setFullYear(endDate.getFullYear() + 1);
            await db.query(
                'INSERT INTO subscriptions (email, access_key, plan_name, plan_duration, server_location, end_date, payment_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [email, keyData.accessUrl, planName, duration, serverLocation, endDate, payment_id.toString()]
            );
            console.log(`Successfully created key for ${email}`);
        } catch (error) {
            console.error('Error in payment callback:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
    res.status(200).send('Webhook received.');
});

app.get('/api/get-keys', async (req, res) => {
    const { email } = req.query; 
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
        const { rows } = await db.query('SELECT * FROM subscriptions WHERE email = $1 ORDER BY start_date DESC', [email]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error.' });
    }
});

app.get('/api/get-all-users', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM subscriptions ORDER BY start_date DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error.' });
    }
});

async function cleanupExpiredKeys() {
    console.log('Running daily cleanup job for expired keys...');
    try {
        const { rows } = await db.query("SELECT * FROM subscriptions WHERE end_date < NOW() AND plan_duration != 'Expired'");
        if (rows.length === 0) {
            console.log('No expired keys to clean up.');
            return;
        }
        for (const sub of rows) {
            console.log(`Found expired key for ${sub.email}. Deleting...`);
            const outlineApiUrl = OUTLINE_SERVERS[sub.server_location];
            if (!outlineApiUrl) {
                console.error(`Invalid server location ('${sub.server_location}') for user ${sub.email}.`);
                continue;
            }
            const keyId = sub.access_key.split('/').pop();
            if (keyId) {
                const deleteResponse = await fetch(`${outlineApiUrl}/access-keys/${keyId}`, { method: 'DELETE' });
                if (deleteResponse.ok) {
                    console.log(`Successfully deleted key ${keyId} from Outline server for ${sub.email}.`);
                    await db.query("UPDATE subscriptions SET plan_duration = 'Expired' WHERE id = $1", [sub.id]);
                } else {
                    console.error(`Failed to delete key ${keyId} for ${sub.email}. Status: ${deleteResponse.status}`);
                }
            }
        }
    } catch (error) {
        console.error('An error occurred during the cleanup job:', error);
    }
}

cron.schedule('0 1 * * *', cleanupExpiredKeys);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Auto-cancellation job for expired keys is scheduled.');
});
