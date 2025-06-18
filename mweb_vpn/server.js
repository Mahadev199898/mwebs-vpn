require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const crypto = require('crypto'); // <-- NEW: For FreeKassa signatures
const db = require('./database');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- NEW: For FreeKassa form data
app.use(express.static(path.join(__dirname, 'public')));

// API Keys and Secrets
const OUTLINE_SERVERS = {
    "USA": process.env.OUTLINE_API_URL_USA,
    "Germany": process.env.OUTLINE_API_URL_GERMANY,
    "Singapore": process.env.OUTLINE_API_URL_SINGAPORE
};
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const FREEKASSA_MERCHANT_ID = process.env.FREEKASSA_MERCHANT_ID;
const FREEKASSA_SECRET_WORD_1 = process.env.FREEKASSA_SECRET_WORD_1;
const FREEKASSA_SECRET_WORD_2 = process.env.FREEKASSA_SECRET_WORD_2;


// --- PAYMENT LOGIC ---

// NOWPayments: Create Payment
app.post('/api/create-payment', async (req, res) => {
    // This logic remains the same
    const { planName, duration, price, email, serverLocation } = req.body;
    if (!planName || !duration || !price || !email || !serverLocation) {
        return res.status(400).json({ message: 'Missing required payment details.' });
    }
    try {
        const orderDescription = `${planName} - ${duration} for ${email} on ${serverLocation}`;
        const response = await fetch("https://api.nowpayments.io/v1/invoice", {
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
        const responseBody = await response.json();
        if (!response.ok) throw new Error(responseBody.message);
        res.status(200).json(responseBody);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// --- NEW: FreeKassa: Create Payment URL ---
app.post('/api/create-freekassa-payment', (req, res) => {
    const { planName, duration, price, email, serverLocation } = req.body;
    if (!planName || !duration || !price || !email || !serverLocation) {
        return res.status(400).json({ message: 'Missing required payment details.' });
    }
    const orderId = `MWEBS-${Date.now()}`;
    const orderDescription = `${planName} - ${duration} for ${email} on ${serverLocation}`;
    
    // Generate signature
    const signString = `${FREEKASSA_MERCHANT_ID}:${price}:${FREEKASSA_SECRET_WORD_1}:${orderId}`;
    const sign = crypto.createHash('md5').update(signString).digest('hex');

    // Construct payment URL
    const paymentUrl = `https://pay.freekassa.ru/?m=${FREEKASSA_MERCHANT_ID}&oa=${price}&o=${orderId}&s=${sign}&us_email=${email}&us_desc=${encodeURIComponent(orderDescription)}`;

    res.status(200).json({ invoice_url: paymentUrl });
});


// --- WEBHOOKS / CALLBACKS ---

// NOWPayments Webhook
app.post('/api/payment-callback', async (req, res) => {
    // This logic remains the same
    const { payment_status, payment_id, order_description } = req.body;
    if (payment_status === 'finished') {
        await createSubscription(order_description, payment_id);
    }
    res.status(200).send('Webhook received.');
});


// --- NEW: FreeKassa Webhook ---
app.post('/api/freekassa-callback', async (req, res) => {
    // FreeKassa sends data as form-urlencoded, not JSON
    const { MERCHANT_ORDER_ID, AMOUNT, intid, us_desc } = req.body;
    
    // Verify signature
    const signString = `${FREEKASSA_MERCHANT_ID}:${AMOUNT}:${FREEKASSA_SECRET_WORD_2}:${MERCHANT_ORDER_ID}`;
    const sign = crypto.createHash('md5').update(signString).digest('hex');

    if (sign !== req.body.SIGN) {
        console.error("FreeKassa Webhook: Invalid Signature.");
        return res.status(400).send("Signature validation failed.");
    }

    await createSubscription(us_desc, intid);
    res.status(200).send("YES"); // FreeKassa requires "YES" response
});


// --- NEW: Centralized Subscription Creation Function ---
async function createSubscription(orderDescription, paymentId) {
    try {
        const parts = orderDescription.split(' on ');
        const serverLocation = parts[1];
        const main_parts = parts[0].split(' for ');
        const email = main_parts[1];
        const plan_parts = main_parts[0].split(' - ');
        const planName = plan_parts[0];
        const duration = plan_parts[1];
        
        const outlineApiUrl = OUTLINE_SERVERS[serverLocation];
        if (!outlineApiUrl) throw new Error(`Invalid server location: ${serverLocation}`);

        const createKeyResponse = await fetch(`${outlineApiUrl}/access-keys`, { method: 'POST', agent: httpsAgent });
        if (!createKeyResponse.ok) throw new Error('Failed to create key on Outline server.');
        const keyData = await createKeyResponse.json();
        
        await fetch(`${outlineApiUrl}/access-keys/${keyData.id}/name`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${email}-${planName}` }),
            agent: httpsAgent 
        });

        const endDate = new Date();
        if (duration === 'Monthly') endDate.setMonth(endDate.getMonth() + 1);
        else if (duration === '6 Months') endDate.setMonth(endDate.getMonth() + 6);
        else if (duration === 'Yearly') endDate.setFullYear(endDate.getFullYear() + 1);
        
        await db.query(
            'INSERT INTO subscriptions (email, access_key, plan_name, plan_duration, server_location, end_date, payment_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [email, keyData.accessUrl, planName, duration, serverLocation, endDate, paymentId.toString()]
        );
        console.log(`Successfully created subscription for ${email} via payment ${paymentId}`);
    } catch (error) {
        console.error('Error during subscription creation:', error);
    }
}

// ... The rest of your API routes (get-keys, get-all-users) and cron job remain the same ...

app.get('/api/get-keys', async (req, res) => { /* ... unchanged ... */ });
app.get('/api/get-all-users', async (req, res) => { /* ... unchanged ... */ });
async function cleanupExpiredKeys() { /* ... unchanged ... */ }
cron.schedule('0 1 * * *', cleanupExpiredKeys);
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
