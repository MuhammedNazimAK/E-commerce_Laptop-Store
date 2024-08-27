// Function to fetch and display user addresses
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

document.addEventListener("DOMContentLoaded", () => {
  // Load user addresses on page load
  fetchAddresses();
  initializeAddAddress();

  const addAddressModal = document.getElementById('addAddressModal');
  addAddressModal.addEventListener('hidden.bs.modal', () => {
    const errorDivs = document.querySelectorAll('.error-message');
    errorDivs.forEach(div => div.textContent = '');
  });

  const placeOrderButton = document.getElementById("placeOrder");
  placeOrderButton.addEventListener("click", handlePlaceOrder);
});

async function handlePlaceOrder() {
  const selectedAddressId = getSelectedAddressId();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
  const couponCode = document.getElementById("appliedCouponCode")?.value || "";

  if (!selectedAddressId) {
    showError("Please select an address.");
    return;
  }

  if (!paymentMethod) {
    showError("Please select a payment method.");
    return;
  }

  try {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    const orderData = {
      addressId: selectedAddressId,
      paymentMethod: paymentMethod,
      couponCode: couponCode,
    };

    const response = await axios.post("/create-order", orderData, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    if (response.data.success) {
      if (paymentMethod === 'cod') {
        handleCODOrder(response.data.orderId);
      } else if (paymentMethod === 'razorpay') {
        handleRazorpayOrder(response.data.orderId, response.data.amount);
      }
    } else {
      showError(response.data.message || "Failed to create order.");
    }
  } catch (error) {
    console.error('Error:', error);
    showError("An error occurred while processing your order. Please try again.");
  }
};

function handleCODOrder(orderId) {
  axios.post(`/confirm-cod-order/${orderId}`)
    .then(response => {
      if (response.data.success) {
        showSuccess("Order placed successfully!");
        setTimeout(() => {
          window.location.href = `/order-confirmation/${orderId}`;
        }, 1500);
      } else {
        showError(response.data.message || "Failed to confirm COD order.");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError("An error occurred while confirming your COD order. Please contact support.");
    });
}

function handleRazorpayOrder(orderId, amount) {
  if (typeof Razorpay === 'undefined') {
    console.error('Razorpay is not defined. Make sure the Razorpay script is loaded.');
    showError("Payment gateway is not available. Please try again later.");
    return;
  }

  const options = {
    key: 'YOUR_RAZORPAY_KEY_ID',
    amount: amount,
    currency: "INR",
    name: "Your Company Name",
    description: "Order Payment",
    order_id: orderId,
    handler: function (response) {
      verifyPayment(response, orderId);
    },
    prefill: {
      name: "Customer Name",
      email: "customer@example.com",
      contact: "9999999999"
    },
    theme: {
      color: "#3399cc"
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

function verifyPayment(paymentResponse, orderId) {
  axios.post(`/verify-payment/${orderId}`, paymentResponse)
    .then(response => {
      if (response.data.success) {
        showSuccess("Payment successful and order placed!");
        window.location.href = `/order-confirmation/${orderId}`;
      } else {
        showError(response.data.message || "Payment verification failed.");
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError("An error occurred while verifying your payment. Please contact support.");
    });
}

function showError(message) {
  Swal.fire({
    icon: "error",
    text: message,
    toast: true,
    position: "top-right",
    showConfirmButton: false,
    timerProgressBar: true,
    timer: 3000,
  });
}

function showSuccess(message) {
  Swal.fire({
    icon: "success",
    text: message,
    toast: true,
    position: "top-right",
    showConfirmButton: false,
    timerProgressBar: true,
    timer: 3000,
  });
}

function getSelectedAddressId() {
  const addressRadios = document.getElementsByName("addressSelection");
  for (const radio of addressRadios) {
    if (radio.checked) {
      return radio.getAttribute("data-address-id");
    }
  }
  return null;
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

// Delete Address
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

// Edit Address Function
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

// validation for add address form
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
