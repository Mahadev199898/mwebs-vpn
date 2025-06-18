document.addEventListener('DOMContentLoaded', () => {
    // Navigation logic to highlight the active page link
    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('.main-header nav a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    // For the homepage link, handle the root path
    if (currentPage === '/' || currentPage.endsWith('index.html')) {
        document.querySelector('.main-header nav a[href="/"]')?.classList.add('active');
    }

    // --- Page-specific Logic ---
    if (currentPage.includes('pricing.html')) {
        handlePricingPage();
    } else if (currentPage.includes('account.html')) {
        handleAccountPage();
    } else if (currentPage.includes('admin.html')) {
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
            summaryText.textContent = `You have selected the ${selectedPlan.planName} (${selectedPlan.duration}) for $${selectedPlan.price}.`;
            modal.style.display = 'flex';
        });
    });

    closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });

    nowPaymentsButton.addEventListener('click', () => {
        handlePayment('/api/create-payment', nowPaymentsButton, 'Pay with Crypto');
    });

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
    // This function remains the same as the full version in the archive
    // ...
}

function handleAdminPage() {
    // This function remains the same as the full version in the archive
    // ...
}
