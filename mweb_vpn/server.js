// FINAL, COMPLETE, AND CORRECTED server.js

require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https'); // <-- Add this line
const db = require('./database');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 10000;

// --- NEW: Create a special agent to allow self-signed certificates ---
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

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
            const parts = order_description.split(' on ');
            const serverLocation = parts[1];
            const main_parts = parts[0].split(' for ');
            const email = main_parts[1];
            const plan_parts = main_parts[0].split(' - ');
            const planName = plan_parts[0];
            const duration = plan_parts[1];

            const outlineApiUrl = OUTLINE_SERVERS[serverLocation];
            if (!outlineApiUrl) throw new Error(`Invalid server location: ${serverLocation}`);

            // Create Outline Key, adding the httpsAgent option
            const createKeyResponse = await fetch(`${outlineApiUrl}/access-keys`, { method: 'POST', agent: httpsAgent });
            if (!createKeyResponse.ok) throw new Error('Failed to create key on Outline server.');
            const keyData = await createKeyResponse.
