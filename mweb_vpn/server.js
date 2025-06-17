require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./database');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const OUTLINE_API_URL = process.env.OUTLINE_API_URL;
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.IPN_SECRET; // A secret you create for webhook security

// --- API ROUTES ---

// Endpoint to create a payment invoice
app.post('/api/create-payment', async (req, res) => {
    const { plan, price, email } = req.body;

    if (!plan || !price || !email) {
        return res.status(400).json({ error: 'Missing plan, price, or email' });
    }

    try {
        const response = await fetch("https://api.nowpayments.io/v1/invoice", {
            method: 'POST',
            headers: { 'x-api-key': NOWPAYMENTS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "price_amount": price,
                "price_currency": "usd",
                "order_id": `MWEBS-${Date.now()}`,
                "order_description": `${plan} Plan for ${email}`,
                "success_url": `${process.env.BASE_URL}/account.html`,
                "cancel_url": `${process.env.BASE_URL}/pricing.html`,
                "ipn_callback_url": `${process.env.BASE_URL}/api/payment-callback`
            })
        });
        const invoice = await response.json();
        res.status(200).json(invoice);
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ error: 'Failed to create payment invoice.' });
    }
});

// Webhook endpoint for NOWPayments to call
app.post('/api/payment-callback', async (req, res) => {
    // Security Check: Verify the webhook is from NOWPayments
    const ipnHeader = req.headers['x-nowpayments-sig'];
    // In a real app, you'd verify this signature against your IPN secret
    // For now, we'll proceed, but this is a critical security step for production.

    const { payment_status, payment_id, order_description } = req.body;

    if (payment_status === 'finished') {
        try {
            // 1. Create Outline Key
            const createKeyResponse = await fetch(`${OUTLINE_API_URL}/access-keys`, { method: 'POST' });
            const keyData = await createKeyResponse.json();
            const accessKey = keyData.accessUrl;
            const keyId = keyData.id;

            // 2. Set a name for the key
            await fetch(`${OUTLINE_API_URL}/access-keys/${keyId}/name`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: order_description })
            });

            // 3. Save to database
            const email = order_description.split(' for ')[1]; // Extract email
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1); // Add 1 month

            await db.query(
                'INSERT INTO subscriptions (email, access_key, plan, end_date, payment_id) VALUES ($1, $2, $3, $4, $5)',
                [email, accessKey, order_description.split(' for ')[0], endDate, payment_id.toString()]
            );
            
            console.log(`Successfully created key for ${email}`);
        } catch (error) {
            console.error('Error in payment callback:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
    res.status(200).send('Webhook received.');
});


// Endpoint for the user account page to get its key
app.get('/api/get-key', async (req, res) => {
    // This needs a real authentication system. For now, we'll use email as a query param.
    // In a real app, you'd get the user from a secure session/token.
    const { email } = req.query; 
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
        const { rows } = await db.query('SELECT * FROM subscriptions WHERE email = $1 ORDER BY start_date DESC LIMIT 1', [email]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'No subscription found for this email.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Database error.' });
    }
});


// Endpoint for the admin panel
app.get('/api/get-all-users', async (req, res) => {
    // Add security check here to ensure only an admin can access this
    try {
        const { rows } = await db.query('SELECT * FROM subscriptions ORDER BY start_date DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error.' });
    }
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});