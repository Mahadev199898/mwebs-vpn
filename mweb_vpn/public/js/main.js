// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('pricing.html')) {
        handlePricingPage();
    } else if (path.includes('account.html')) {
        handleAccountPage();
    } else if (path.includes('admin.html')) {
        handleAdminPage();
    }
});

function handlePricingPage() {
    const formContainer = document.getElementById('payment-form');
    if (!formContainer) return;

    formContainer.innerHTML = `
        <input type="email" id="email-input" placeholder="Enter your email" required style="width: 100%; padding: 10px; margin-bottom: 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--primary-accent); color: white;">
        <button id="pay-button" class="cta-button">Proceed to Payment</button>
    `;

    const payButton = document.getElementById('pay-button');
    payButton.addEventListener('click', async () => {
        const emailInput = document.getElementById('email-input');
        if (!emailInput.value) {
            alert('Please enter your email address.');
            return;
        }

        payButton.textContent = 'Processing...';
        payButton.disabled = true;

        try {
            const response = await fetch('/api/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: 'Lunar Cycle',
                    price: 5.00,
                    email: emailInput.value
                })
            });
            const data = await response.json();
            if (data.invoice_url) {
                // Save email to local storage to retrieve on account page
                localStorage.setItem('mwebs_user_email', emailInput.value);
                window.location.href = data.invoice_url;
            } else {
                throw new Error(data.error || 'Failed to get payment URL.');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            payButton.textContent = 'Proceed to Payment';
            payButton.disabled = false;
        }
    });
}

function handleAccountPage() {
    const accountDetails = document.getElementById('account-details');
    if (!accountDetails) return;

    // Retrieve email from local storage after payment
    const email = localStorage.getItem('mwebs_user_email');
    if (!email) {
        accountDetails.innerHTML = `<h3>Could not find user email.</h3><p>Please log in or check your confirmation email.</p>`;
        return;
    }

    accountDetails.innerHTML = `<p>Fetching your details...</p>`;

    fetch(`/api/get-key?email=${email}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            const expiryDate = new Date(data.end_date).toLocaleDateString();
            accountDetails.innerHTML = `
                <h3>Your Access Key:</h3>
                <div id="key-display">${data.access_key}</div>
                <button id="copy-key-button" class="cta-button">Copy Key</button>
                <p style="margin-top: 1rem;"><strong>Plan:</strong> ${data.plan}</p>
                <p><strong>Expires on:</strong> ${expiryDate}</p>
            `;

            document.getElementById('copy-key-button').addEventListener('click', () => {
                navigator.clipboard.writeText(data.access_key);
                document.getElementById('copy-key-button').textContent = 'Copied!';
                setTimeout(() => {
                    document.getElementById('copy-key-button').textContent = 'Copy Key';
                }, 2000);
            });
        })
        .catch(error => {
            accountDetails.innerHTML = `<h3>Error</h3><p>${error.message}</p>`;
        });
}

function handleAdminPage() {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;

    fetch('/api/get-all-users')
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="4">No users found.</td></tr>`;
                return;
            }
            tableBody.innerHTML = data.map(user => `
                <tr>
                    <td>${user.email}</td>
                    <td>${user.plan}</td>
                    <td style="word-break: break-all;">${user.access_key}</td>
                    <td>${new Date(user.end_date).toLocaleDateString()}</td>
                </tr>
            `).join('');
        })
        .catch(error => {
            tableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        });
}