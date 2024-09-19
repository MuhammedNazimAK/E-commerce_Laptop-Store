document.addEventListener('DOMContentLoaded', () => {
  const addressList = document.getElementById('address-list');
  
  if (!addressList) {
      console.error('Address list element not found');
      return;
  }

  // Populate Edit Address Modal
  addressList.addEventListener('click', async (e) => {
      if (e.target.classList.contains('edit-address')) {
          const addressId = e.target.getAttribute('data-id');
          try {
              const response = await axios.get(`/my-account/edit-address/${addressId}`);
              const address = response.data;
              document.getElementById('editAddressId').value = address._id;
              document.getElementById('editAddressName').value = address.name;
              document.getElementById('editAddressType').value = address.addressType;
              document.getElementById('editCity').value = address.city;
              document.getElementById('editLandMark').value = address.landMark;
              document.getElementById('editState').value = address.state;
              document.getElementById('editPinCode').value = address.pinCode;
              document.getElementById('editMobile').value = address.mobile;
          } catch (error) {
              console.error('Error:', error);
              Swal.fire('Error', 'Failed to fetch address details', 'error');
          }
      }
  });

  // Edit Address
  const AddressForm = document.getElementById('editAddressForm');
      AddressForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const isNameValid = validateNameInput('editAddressName', 'editAddressNameError');
          const isAddressTypeValid = validateAddressInput('editAddressType', 'editAddressTypeError', 'Please enter an address type');   
          const isCityValid = validateAddressInput('editCity', 'editCityError', 'Please enter a city');   
          const isLandMarkValid = validateAddressInput('editLandMark', 'editLandMarkError', 'Please enter a landmark');   
          const isStateValid = validateAddressInput('editState', 'editStateError', 'Please enter a state');
          const isPinCodeValid = validatePinCodeInput('editPinCode', 'editPinCodeError');
          const isMobileValid = validateMobileInput('editMobile', 'editMobileError');

          if (!isNameValid || !isAddressTypeValid || !isCityValid || !isLandMarkValid || !isStateValid || !isPinCodeValid || !isMobileValid) {
              return;
          }

          const formData = new FormData(AddressForm);
          const data = Object.fromEntries(formData);
          try {
              const response = await axios.post(`/my-account/edit-address/${data.addressId}`, data);
              if (response.data.success) {
                  Swal.fire('Success', response.data.message, 'success');
                  updateAddressCard(data);
                  $('#editAddressModal').modal('hide');
                  showSuccess(response.data.message || 'Address updated successfully');
              } else {
                  showError(response.data.message || 'Failed to update address');
              }
          } catch (error) {
              console.error('Error:', error);
              showError('Failed to update address');
          }
      });

      // clear error messages when the modal is closed
      const editAddressModal = document.getElementById('editAddressModal');
      editAddressModal.addEventListener('hidden.bs.modal', () => {
          const errorDivs = document.querySelectorAll('.error-message');
          errorDivs.forEach(div => div.textContent = '');
      });

      const addAddressModal = document.getElementById('addAddressModal');
      addAddressModal.addEventListener('hidden.bs.modal', () => {
        const errorDivs = document.querySelectorAll('.error-message');
        errorDivs.forEach(div => div.textContent = '');
     });

      //add address
      const addAddressForm = document.getElementById('addAddressForm');
      addAddressForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          if (validateAllInputs()) {
          const submitButton = addAddressForm.querySelector('button[type="submit"]');
          submitButton.disabled = true;
          submitButton.textContent = 'Saving...';


          const formData = new FormData(addAddressForm);
          const data = Object.fromEntries(formData);
          try {
              const response = await axios.post('/my-account/add-address', data);
              if (response.data.success) {
                if (response.data.address) {
                  createAddressCard(response.data.address);
                  $('#addAddressModal').modal('hide');
                  showSuccess(response.data.message || 'Address added successfully');
                  addAddressForm.reset();
              } else {
                console.error('Error:', response.data.message || 'Failed to add address');
              }
            }
          } catch (error) {
              console.error('Error:', error);
              showError('Failed to add address');
          } finally {
              submitButton.disabled = false;
              submitButton.textContent = 'Save';
        }
    }
});


  // Delete Address
  addressList.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-address')) {
          const addressId = e.target.getAttribute('data-id');
          const result = await Swal.fire({
              title: 'Are you sure?',
              text: "You won't be able to revert this!",
              icon: 'warning',
              showCancelButton: true,
              confirmButtonColor: '#3085d6',
              cancelButtonColor: '#d33',
              confirmButtonText: 'Yes, delete it!'
          });

          if (result.isConfirmed) {
              try {
                  const response = await axios.delete(`/my-account/delete-address/${addressId}`);
                  if (response.data.success) {
                      showSuccess(response.data.message || 'Address deleted successfully');
                      removeAddressCard(addressId);
                  } else {
                      showError (response.data.message || 'Failed to delete address');
                  }
              } catch (error) {
                  console.error('Error:', error);
                  showError('Failed to delete address');
              }
          }
      }
  });
});


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

function validateAddressInput(inputId, errrorDivId, errorMessage) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errrorDivId);

    if (input.value.trim() == '') {
        errorDiv.textContent = errorMessage;
        return false;
    } else {
        errorDiv.textContent = '';
        return true;
    }
}

function validateNameInput(inputId, errrorDivId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errrorDivId);

    if (input.value.trim() == '') {
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

function validatePinCodeInput(inputId, errrorDivId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errrorDivId);

    if (!/^\d{6}$/.test(input.value)) {
        errorDiv.textContent = 'Please enter a valid 6-digit pin code';
        return false;
    } else if (input.value.length < 6) {
        errorDiv.textContent = 'Please enter a valid 6-digit pin code';
        return false;
    } else {
        errorDiv.textContent = '';
        return true;
    }
}

function validateMobileInput(inputId, errrorDivId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errrorDivId);

    if (!/^\d{10}$/.test(input.value)) {
        errorDiv.textContent = 'Please enter a valid 10-digit mobile number';
        return false;
    } else if (input.value.length < 10) {
        errorDiv.textContent = 'Please enter a valid 10-digit mobile number';
        return false;
    } else {
        errorDiv.textContent = '';
        return true;
    }
}


function updateAddressCard(address) {
  const addressCard = document.querySelector(`[data-id="${address.addressId}"]`).closest('.address-card');
  if (addressCard) {
      addressCard.querySelector('h5').textContent = address.name;
      addressCard.querySelector('p:nth-child(2)').innerHTML = `<strong>Type:</strong> ${address.addressType}`;
      addressCard.querySelector('p:nth-child(3)').innerHTML = `<strong>City:</strong> ${address.city}`;
      addressCard.querySelector('p:nth-child(4)').innerHTML = `<strong>Landmark:</strong> ${address.landMark}`;
      addressCard.querySelector('p:nth-child(5)').innerHTML = `<strong>State:</strong> ${address.state}`;
      addressCard.querySelector('p:nth-child(6)').innerHTML = `<strong>Pin Code:</strong> ${address.pinCode}`;
      addressCard.querySelector('p:nth-child(7)').innerHTML = `<strong>Mobile:</strong> ${address.mobile}`;
  }
}


const createAddressCard = (address) => {
    const addressList = document.getElementById('address-list');
    if (!addressList) {
      console.error('Address list element not found');
      return;
    }
  
    // Find or create the row
  let row = addressList.querySelector('.row');
  if (!row) {
    row = document.createElement('div');
    row.classList.add('row');
    addressList.appendChild(row);
  }

  const addressId = address.addressId || address._id;

  const addressCard = document.createElement('div');
  addressCard.classList.add('col-md-6', 'mb-4');
  addressCard.setAttribute('data-id', addressId);
  addressCard.innerHTML = `
    <div class="address-card p-3 border rounded">
      <h5>${address.name}</h5>
      <p><strong>Type:</strong> ${address.addressType}</p>
      <p><strong>City:</strong> ${address.city}</p>
      <p><strong>Landmark:</strong> ${address.landMark}</p>
      <p><strong>State:</strong> ${address.state}</p>
      <p><strong>Pin Code:</strong> ${address.pinCode}</p>
      <p><strong>Mobile:</strong> ${address.mobile}</p>
      <button class="btn btn-md btn-black-default-hover edit-address" data-id="${addressId}" data-bs-toggle="modal" data-bs-target="#editAddressModal">Edit</button>
      <button class="btn btn-md btn-black-default-hover delete-address" data-id="${addressId}">Delete</button>
    </div>
  `;

  row.appendChild(addressCard);
};

function removeAddressCard(addressId) {
  const addressCard = document.querySelector(`[data-id="${addressId}"]`).closest('.col-md-6');
  if (addressCard) {
      addressCard.remove();
  }
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
