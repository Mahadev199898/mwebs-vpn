// NEW main.js with Navigation Logic

document.addEventListener('DOMContentLoaded', () => {
    // --- NEW NAVIGATION LOGIC ---
    // Get the current page path, e.g., "/pricing.html"
    const currentPage = window.location.pathname;
    // Find all the links in the navigation bar
    const navLinks = document.querySelectorAll('.main-header nav a');

    navLinks.forEach(link => {
        // If a link's href matches the current page path, add the 'active' class
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    // --- END OF NAVIGATION LOGIC ---

    // The rest of the page-specific logic
    if (currentPage.includes('pricing.html') || currentPage === '/' || currentPage.endsWith('index.html')) {
        const pricingContainer = document.querySelector('.pricing-container');
        if(pricingContainer) handlePricingPage();
    }
    if (currentPage.includes('account.html')) {
        handleAccountPage();
    } else if (currentPage.includes('admin.html')) {
        handleAdminPage();
    }
});

function handlePricingPage() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    const closeButton = document.querySelector('.close-button');
    const confirmButton = document.getElementById('confirm-payment-button');
    const summaryText = document.getElementById('modal-summary');
    const emailInput = document.getElementById('email-input');
    const serverLocationSelect = document.getElementById('server-location');
    let selectedPlan = {};

    document.querySelectorAll('.duration-option').forEach(option => {
        option.addEventListener('click', () => {
            selectedPlan = {
                planName: option.dataset.planName,
                duration: option.dataset.duration,
                price: parseFloat(option.dataset.price)
            };
            summaryText.textContent = `You have selected the ${selectedPlan.planName} (${selectedPlan.duration}) for $${selectedPlan.price}.`;
            modal.style.display = 'flex';
        });
    });

    closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target == modal) { modal.style.display = 'none'; } });

    confirmButton.addEventListener('click', async () => {
        if (!emailInput.value) { alert('Please enter your email address.'); return; }
        confirmButton.textContent = 'Processing...';
        confirmButton.disabled = true;
        try {
            const response = await fetch('/api/create-payment', {
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
            confirmButton.textContent = 'Proceed to Payment';
            confirmButton.disabled = false;
        }
    });
}

function handleAccountPage() {
    const accountDetails = document.getElementById('account-details');
    if (!accountDetails) return;
    const email = localStorage.getItem('mwebs_user_email');
    if (!email) {
        accountDetails.innerHTML = `<h3>Could not find user data.</h3><p>Please complete a purchase to see your keys, or enter your email below to search.</p>
        <div style="margin-top: 1rem; max-width: 400px; margin-left: auto; margin-right: auto; text-align: left;">
            <input type="email" id="search-email-input" placeholder="Enter your email to find keys" style="width: 100%; padding: 10px; margin-bottom: 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--primary-accent); color: white; font-family: var(--font-body);">
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
            html += `<div class="subscription-card"><h4>${sub.plan_name} - ${sub.server_location}</h4><p><strong>Status:</strong> ${sub.plan_duration}</p><p><strong>Expires on:</strong> ${expiryDate}</p><div class="key-display">${sub.access_key}</div><button class="cta-button copy-button" data-key="${sub.access_key}">Copy Key</button></div>`;
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
                <td>${user.email}</td>
                <td>${user.plan_name} (${user.plan_duration})</td>
                <td>${user.server_location}</td>
                <td style="word-break: break-all;">${user.access_key}</td>
                <td>${new Date(user.end_date).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }).catch(error => { tableBody.innerHTML = `<tr><td colspan="5">Error loading users: ${error.message}</td></tr>`; });
}
