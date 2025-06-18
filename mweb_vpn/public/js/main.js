document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('pricing.html') || path === '/' || path.endsWith('index.html')) {
        handlePricingPage();
    }
    if (path.includes('account.html')) {
        handleAccountPage();
    } else if (path.includes('admin.html')) {
        handleAdminPage();
    }
});

function handlePricingPage() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    const closeButton = modal.querySelector('.close-button');
    const summaryText = document.getElementById('modal-summary');
    const emailInput = document.getElementById('email-input');
    const serverLocationSelect = document.getElementById('server-location');
    const nowPaymentsButton = document.getElementById('nowpayments-pay-button');
    const freekassaButton = document.getElementById('freekassa-pay-button');
    let selectedPlan = {};

    document.querySelectorAll('.duration-option').forEach(option => {
        option.addEventListener('click', () => {
            selectedPlan = {
                planName: option.dataset.planName,
                duration: option.dataset.duration,
                price: parseFloat(option.dataset.price)
            };
            summaryText.textContent = `You have selected the <span class="math-inline">\{selectedPlan\.planName\} \(</span>{selectedPlan.duration}) for $${selectedPlan.price}.`;
            modal.style.display = 'flex';
        });
    });

    closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });

    nowPaymentsButton.addEventListener('click', () => handlePayment('/api/create-nowpayments', nowPaymentsButton, 'Pay with Crypto'));
    freekassaButton.addEventListener('click', () => handlePayment('/api/create-freekassa', freekassaButton, 'Pay with FreeKassa'));

    async function handlePayment(apiEndpoint, buttonElement, buttonText) {
        if (!emailInput.value) { alert('Please enter your email address.'); return; }
        buttonElement.textContent = 'Processing...';
        buttonElement.disabled = true;
        freekassaButton.disabled = true;
        nowPaymentsButton.disabled = true;
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...selectedPlan, email: emailInput.value, serverLocation: serverLocationSelect.value })
            });
            const data = await response.json();
            if (data.invoice_url) {
                localStorage.setItem('mwebs_user_email', emailInput.value);
                window.location.href = data.invoice_url;
            } else { throw new Error(data.message || 'Failed to get payment URL.'); }
        } catch (error) {
            alert('Error: ' + error.message);
            buttonElement.textContent = buttonText;
            buttonElement.disabled = false;
            freekassaButton.disabled = false;
            nowPaymentsButton.disabled = false;
        }
    }
}

function handleAccountPage() {
    const accountDetails = document.getElementById('account-details');
    if (!accountDetails) return;
    const email = localStorage.getItem('mwebs_user_email');
    if (!email) {
        accountDetails.innerHTML = `<h3>Could not find user data.</h3><p>Enter your email below to find your keys.</p>
        <div style="margin-top: 1rem; max-width: 400px; margin-left: auto; margin-right: auto; text-align: left;">
            <input type="email" id="search-email-input" placeholder="Enter your purchase email" style="width: 100%; padding: 10px; margin-bottom: 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--primary-accent); color: white; font-family: var(--font-body);">
            <button id="find-keys-button" class="cta-button" style="width: 100%;">Find My Keys</button>
        </div>`;
        document.getElementById('find-keys-button').addEventListener('click', () => {
            const searchEmail = document.getElementById('search-email-input').value;
            if (searchEmail) { localStorage.setItem('mwebs_user_email', searchEmail); window.location.reload(); }
        });
        return;
    }
    accountDetails.innerHTML = `<p>Fetching active subscriptions for ${email}...</p>`;
    fetch(`/api/get-keys?email=${email}`).then(res => res.json()).then(subscriptions => {
        if (subscriptions.error) throw new Error(subscriptions.error);
        if (subscriptions.length === 0) { accountDetails.innerHTML = `<h3>No subscriptions found for ${email}.</h3>`; return; }
        let html = '<h3>Your Active Keys</h3>';
        subscriptions.forEach(sub => {
            const expiryDate = new Date(sub.end_date).toLocaleDateString();
            html += `<div class="subscription-card"><h4>${sub.plan_name} - ${sub.server_location}</h4><p><strong>Status:</strong> ${sub.status}</p><p><strong>Expires on:</strong> <span class="math-inline">\{expiryDate\}</p\><div class\="key\-display"\></span>{sub.access_key}</div><button class="cta-button copy-button" data-key="${sub.access_key}">Copy Key</button></div>`;
        });
        accountDetails.innerHTML = html;
        document.querySelectorAll('.copy-button').forEach(button => {
            button.addEventListener('click', (e) => {
                navigator.clipboard.writeText(e.target.dataset.key);
                e.target.textContent = 'Copied!';
                setTimeout(() => { e.target.textContent = 'Copy Key'; }, 2000);
            });
        });
    }).catch(error => { accountDetails.innerHTML = `<h3>Error</h3><p>${error.message}</p>`; });
}

function handleAdminPage() {
    const tableBody = document.getElementById('admin-table-body');
    if (!tableBody) return;
    fetch('/api/get-all-users').then(res => res.json()).then(data => {
        if (data.error) throw new Error(data.error);
        if (data.length === 0) { tableBody.innerHTML = `<tr><td colspan="5">No users found.</td></tr>`; return; }
        tableBody.innerHTML = data.map(user => `
            <tr>
                <td><span class="math-inline">\{user\.email\}</td\>
