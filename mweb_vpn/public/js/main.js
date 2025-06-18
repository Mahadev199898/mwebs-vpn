// Fully updated main.js
document.addEventListener('DOMContentLoaded', () => {
    // ... navigation logic is unchanged ...

    const path = window.location.pathname;
    if (path.includes('pricing.html') || path === '/' || path.endsWith('index.html')) {
        const pricingContainer = document.querySelector('.pricing-container');
        if(pricingContainer) handlePricingPageV3(); // Use new version
    }
    // ... other page handlers are unchanged ...
});

function handlePricingPageV3() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    const closeButton = document.querySelector('.close-button');
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
            summaryText.textContent = `You have selected the ${selectedPlan.planName} (${selectedPlan.duration}) for $${selectedPlan.price}.`;
            modal.style.display = 'flex';
        });
    });

    closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });

    // Event listener for NOWPayments
    nowPaymentsButton.addEventListener('click', () => {
        handlePayment('/api/create-payment', nowPaymentsButton, 'Pay with Crypto');
    });

    // Event listener for FreeKassa
    freekassaButton.addEventListener('click', () => {
        handlePayment('/api/create-freekassa-payment', freekassaButton, 'Pay with FreeKassa');
    });

    async function handlePayment(apiEndpoint, buttonElement, buttonText) {
        if (!emailInput.value) {
            alert('Please enter your email address.');
            return;
        }
        buttonElement.textContent = 'Processing...';
        buttonElement.disabled = true;
        freekassaButton.disabled = true; // Disable both buttons
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

// ... All other functions (handleAccountPage, handleAdminPage) remain unchanged ...
