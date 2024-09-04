function fetchAddresses() {
  const addressListContainer = document.getElementById("addressList");
  
  axios.get("/my-account/add-address")
    .then((response) => {
      const addresses = response.data.addresses.address;
      if (addresses && addresses.length > 0) {
        addressListContainer.innerHTML = addresses
          .map(
            (address) => `
              <div id="addressSubContainer${address._id}" class="card mb-3">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start">
                    <div class="form-check flex-grow-1">
                      <input class="form-check-input" type="radio" name="addressSelection" value="${address._id}" data-address-id="${address._id}">
                      <label class="form-check-label" for="address_${address._id}">
                        ${address.name}<br>
                        ${address.addressType}<br>
                        ${address.city}, ${address.state} - ${address.pinCode}<br>
                        Phone: ${address.mobile}
                      </label>
                    </div>  
                    <div class="dropdown dropdown-menu-end">
                      <a href="#" data-bs-toggle="dropdown">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="5" r="1"></circle>
                          <circle cx="12" cy="12" r="1"></circle>
                          <circle cx="12" cy="19" r="1"></circle>
                        </svg>
                      </a>
                      <div class="dropdown-menu">
                        <a onclick="editAddress('${address._id}', '${address.addressType}', '${address.name}', '${address.mobile}', '${address.city}', '${address.state}', '${address.pinCode}', '${address.landMark}')" class="dropdown-item">Edit info</a>
                        <a onclick="removeAddress('${address._id}')" class="dropdown-item text-danger">Delete</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
          )
          .join("");
      } else {
        addressListContainer.innerHTML = "<p>No addresses available. Please add a new address.</p>";
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      showError(`An error occurred while fetching addresses: ${error.message}`);
    });
}

const API_ENDPOINTS = {
  CREATE_ORDER: '/create-order',
  CONFIRM_COD_ORDER: '/confirm-cod-order',
  VERIFY_PAYMENT: '/verify-payment',
  USE_FUNDS: '/use-funds'
};

const ERROR_MESSAGES = {
  NO_ADDRESS: 'Please select an address.',
  NO_PAYMENT_METHOD: 'Please select a payment method.',
  ORDER_CREATION_FAILED: 'Failed to create order.',
  COD_CONFIRMATION_FAILED: 'Failed to confirm COD order.',
  PAYMENT_VERIFICATION_FAILED: 'Payment verification failed.',
  INSUFFICIENT_BALANCE: 'Insufficient wallet balance. Choose another payment method.',
  GENERAL_ERROR: 'An error occurred. Please try again.',
  RAZORPAY_UNDEFINED: 'Payment gateway is not available. Please try again later.'
};

document.addEventListener("DOMContentLoaded", () => {
  fetchAddresses();
  initializeAddAddress();

  const addAddressModal = document.getElementById('addAddressModal');
  addAddressModal.addEventListener('hidden.bs.modal', clearErrorMessages);

  const placeOrderButton = document.getElementById("placeOrder");
  placeOrderButton.addEventListener("click", debounce(handlePlaceOrder, 300));
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function handlePlaceOrder() {
  try {
    showLoading('Placing order...');
    const orderData = validateOrderData();
    if (!orderData) return;

    const response = await createOrder(orderData);

    if (response.data.success) {
      await handlePaymentMethod(response.data);
    } else {
      showError(response.data.message || ERROR_MESSAGES.ORDER_CREATION_FAILED);
    }
    return response.data.success;
  } catch (error) {
    handleError(error);
    throw error;
  } finally {
    hideLoading();
  }
}

function validateOrderData() {
  const selectedAddressId = getSelectedAddressId();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const couponCode = document.getElementById("appliedCouponCode")?.value?.trim() || "";

  if (!selectedAddressId) {
    showError(ERROR_MESSAGES.NO_ADDRESS);
    return null;
  }

  if (!paymentMethod) {
    showError(ERROR_MESSAGES.NO_PAYMENT_METHOD);
    return null;
  }

  return { addressId: selectedAddressId, paymentMethod, couponCode };
}

async function createOrder(orderData) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  return await axios.post(API_ENDPOINTS.CREATE_ORDER, orderData, {
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json'
    },
    withCredentials: true
  });
}

async function handlePaymentMethod(responseData) {
  const { paymentMethod, orderId, amount } = responseData;
  switch (paymentMethod) {
    case 'cod':
      await handleCODOrder(orderId);
      break;
    case 'razorpay':
      await handleRazorpayOrder(orderId, amount);
      break;
    case 'wallet':
      await handleWalletOrder(orderId, amount);
      break;
    default:
      showError('Invalid payment method');
  }
}

async function handleCODOrder(orderId) {
  try {
    const response = await axios.post(`${API_ENDPOINTS.CONFIRM_COD_ORDER}/${orderId}`);
    if (response.data.success) {
      showSuccess("Order placed successfully!");
      redirectToOrderConfirmation(orderId);
    } else {
      showError(response.data.message || ERROR_MESSAGES.COD_CONFIRMATION_FAILED);
    }
  } catch (error) {
    handleError(error);
  }
}

function handleRazorpayOrder(orderId, amount) {
  const razorpayKey = document.querySelector('script[data-razorpay-key]').getAttribute('data-razorpay-key');

  if (typeof Razorpay === 'undefined') {
    console.error(ERROR_MESSAGES.RAZORPAY_UNDEFINED);
    showError(ERROR_MESSAGES.RAZORPAY_UNDEFINED);
    return;
  }

  const options = {
    key: razorpayKey,
    amount: amount * 100,
    currency: "INR",
    name: "Laptop Store",
    description: "Order Payment",
    order_id: orderId,
    handler: (response) => verifyPayment(response, orderId),
    theme: { color: "#3399cc" }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

async function verifyPayment(paymentResponse, orderId) {
  try {
    const response = await axios.post(`${API_ENDPOINTS.VERIFY_PAYMENT}/${orderId}`, paymentResponse);
    if (response.data.success) {
      showSuccess("Payment successful and order placed!");
      redirectToOrderConfirmation(orderId);
    } else {
      showError(response.data.message || ERROR_MESSAGES.PAYMENT_VERIFICATION_FAILED);
    }
  } catch (error) {
    handleError(error);
  }
}

async function handleWalletOrder(orderId, amount) {
  try {
    const response = await axios.post(API_ENDPOINTS.USE_FUNDS, { amount, orderId });
    if (response.data.success) {
      showSuccess('Order placed successfully using wallet balance');
      await new Promise(resolve => setTimeout(resolve, 2000));
      showLoading('Redirecting to order confirmation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      redirectToOrderConfirmation(orderId);
    } else {
      showError(response.data.message || ERROR_MESSAGES.GENERAL_ERROR);
    }
  } catch (error) {
    if (error.response && error.response.status === 400) {
      showError(ERROR_MESSAGES.INSUFFICIENT_BALANCE);
    } else {
      handleError(error);
    }
  }
}

function showError(message) {
  displayMessage('error', message);
}

function showSuccess(message) {
  displayMessage('success', message);
}

function displayMessage(icon, message) {
  Swal.fire({
    icon,
    text: message,
    toast: true,
    position: 'top-right',
    showConfirmButton: false,
    timerProgressBar: true,
    timer: 3000
  });
}

function getSelectedAddressId() {
  const selectedRadio = document.querySelector('input[name="addressSelection"]:checked');
  return selectedRadio ? selectedRadio.getAttribute("data-address-id") : null;
}

function handleError(error) {
  console.error('Error:', error);
  showError(ERROR_MESSAGES.GENERAL_ERROR);
}

function showLoading(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    showConfirmButton: false,
    willOpen: () => {
      Swal.showLoading();
    }
  });
}

function hideLoading() {
  Swal.close();
}

function redirectToOrderConfirmation(orderId) {
    window.location.href = `/order-confirmation/${orderId}`;
}

function clearErrorMessages() {
  const errorDivs = document.querySelectorAll('.error-message');
  errorDivs.forEach(div => div.textContent = '');
}


// Add address form initialization
function initializeAddAddress() {
  const addAddressForm = document.getElementById('addAddressForm');
  if (addAddressForm) {
    addAddressForm.addEventListener('submit', handleAddAddress);
  }
}

async function handleAddAddress(e) {
  e.preventDefault();
  
  if (validateAllInputs()) {
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
      const response = await axios.post('/my-account/add-address', data);
      if (response.data.success) {
        Swal.fire('Success', 'Address added successfully', 'success');
        fetchAddresses();
        $('#addAddressModal').modal('hide');
        e.target.reset();
      } else {
        showError(response.data.message || 'Failed to add address');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Failed to add address');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save';
    }
  }
}

function removeAddress(addressId) {
  Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  }).then((result) => {
    if (result.isConfirmed) {
      axios.delete(`/my-account/delete-address/${addressId}`)
        .then(response => {
          if (response.data.success) {
            Swal.fire('Deleted!', 'Your address has been deleted.', 'success');
            fetchAddresses();
          } else {
            showError('Failed to delete address');
          }
        })
        .catch(error => {
          console.error('Error:', error);
          showError('An error occurred while deleting the address');
        });
    }
  });
}

function editAddress(id, addressType, name, mobile, city, state, pinCode, landMark) {
  const editAddressForm = document.getElementById("editAddressForm");

  document.getElementById("editAddressId").value = id;
  document.getElementById("editAddressName").value = name;
  document.getElementById("editAddressType").value = addressType;
  document.getElementById("editCity").value = city;
  document.getElementById("editLandMark").value = landMark;
  document.getElementById("editState").value = state;
  document.getElementById("editPinCode").value = pinCode;
  document.getElementById("editMobile").value = mobile;

  clearErrorMessages();

  $('#editAddressModal').modal('show');
}

document.getElementById("editAddressForm").addEventListener("submit", handleEditAddress);

async function handleEditAddress(e) {
  e.preventDefault();
    
  if (!validateEditAddressForm()) {
    return;
  }

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const response = await axios.post(`/my-account/edit-address/${data.addressId}`, data);
    
    if (response.data.success) {
      showSuccess(response.data.message);
      fetchAddresses();
      $('#editAddressModal').modal('hide');
    } else {
      showError(response.data.message);
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Failed to update address');
  }
}


function validateEditAddressForm() {
  let isValid = true;

  // Validate Name
  const name = document.getElementById("editAddressName").value.trim();
  if (name === '') {
    showError("editAddressName", "Please enter a name");
    isValid = false;
  } else {
    clearError("editAddressName");
  }

  // Validate Mobile
  const mobile = document.getElementById("editMobile").value.trim();
  if (mobile === '') {
    showError("editMobile", "Please enter a mobile number");
    isValid = false;
  } else if (!/^\d{10}$/.test(mobile)) {
    showError("editMobile", "Please enter a valid 10-digit mobile number");
    isValid = false;
  } else {
    clearError("editMobile");
  }

  // Validate Landmark
  const landMark = document.getElementById("editLandMark").value.trim();
  if (landMark === '') {
    showError("editLandMark", "Please enter a landmark");
    isValid = false;
  } else {
    clearError("editLandMark");
  }

  // Validate State
  const state = document.getElementById("editState").value.trim();
  if (state === '') {
    showError("editState", "Please enter a state");
    isValid = false;
  } else {
    clearError("editState");
  }

  // Validate Pin Code
  const pinCode = document.getElementById("editPinCode").value.trim();
  if (pinCode === '') {
    showError("editPinCode", "Please enter a pin code");
    isValid = false;
  } else if (!/^\d{6}$/.test(pinCode)) {
    showError("editPinCode", "Please enter a valid 6-digit pin code");
    isValid = false;
  } else {
    clearError("editPinCode");
  }
  return isValid;
}

function showError(fieldId, message) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearError(fieldId) {
  const errorElement = document.getElementById(`${fieldId}Error`);
  if (errorElement) {
    errorElement.textContent = '';
  }
}

function clearErrorMessages() {
  const errorElements = document.querySelectorAll('[id$="Error"]');
  errorElements.forEach(element => {
    element.textContent = '';
  });
}

function validateAllInputs() {
  const isNameValid = validateNameInput('addressName', 'addressNameError');
  const isAddressTypeValid = validateAddressInput('addressType', 'addressTypeError', 'Please enter an address type');
  const isCityValid = validateAddressInput('city', 'cityError', 'Please enter a city');
  const isLandMarkValid = validateAddressInput('landMark', 'landMarkError', 'Please enter a landmark');
  const isStateValid = validateAddressInput('state', 'stateError', 'Please enter a state');
  const isPinCodeValid = validatePinCodeInput('pinCode', 'pinCodeError');
  const isMobileValid = validateMobileInput('mobile', 'mobileError');

  return isNameValid && isAddressTypeValid && isCityValid && isLandMarkValid && isStateValid && isPinCodeValid && isMobileValid;
}

function validateAddressInput(inputId, errorDivId, errorMessage) {
  const input = document.getElementById(inputId);
  const errorDiv = document.getElementById(errorDivId);

  if (input.value.trim() === '') {
    errorDiv.textContent = errorMessage;
    return false;
  } else {
    errorDiv.textContent = '';
    return true;
  }
}

function validateNameInput(inputId, errorDivId) {
  const input = document.getElementById(inputId);
  const errorDiv = document.getElementById(errorDivId);

  if (input.value.trim() === '') {
    errorDiv.textContent = 'Please enter a name';
    return false;
  } else if (!/^[a-zA-Z\s']+$/.test(input.value)) {
    errorDiv.textContent = 'Please enter a valid name';
    return false;
  } else {
    errorDiv.textContent = '';
    return true;
  }
}

function validatePinCodeInput(inputId, errorDivId) {
  const input = document.getElementById(inputId);
  const errorDiv = document.getElementById(errorDivId);

  if (!/^\d{6}$/.test(input.value)) {
    errorDiv.textContent = 'Please enter a valid 6-digit pin code';
    return false;
  } else {
    errorDiv.textContent = '';
    return true;
  }
}

function validateMobileInput(inputId, errorDivId) {
  const input = document.getElementById(inputId);
  const errorDiv = document.getElementById(errorDivId);

  if (!/^\d{10}$/.test(input.value)) {
    errorDiv.textContent = 'Please enter a valid 10-digit mobile number';
    return false;
  } else {
    errorDiv.textContent = '';
    return true;
  }
}
