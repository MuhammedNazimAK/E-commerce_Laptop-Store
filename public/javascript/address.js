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
  const editAddressForm = document.getElementById('editAddressForm');
  if (editAddressForm) {
      editAddressForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(editAddressForm);
          const data = Object.fromEntries(formData);
          try {
              const response = await axios.post(`/my-account/edit-address/${data.addressId}`, data);
              if (response.data.success) {
                  Swal.fire('Success', response.data.message, 'success');
                  updateAddressCard(data);
                  $('#editAddressModal').modal('hide');
              } else {
                  Swal.fire('Error', response.data.message, 'error');
              }
          } catch (error) {
              console.error('Error:', error);
              Swal.fire('Error', 'Failed to update address', 'error');
          }
      });
  }

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
                  const response = await axios.post(`/my-account/delete-address/${addressId}`);
                  if (response.data.success) {
                      Swal.fire('Deleted!', response.data.message, 'success');
                      removeAddressCard(addressId);
                  } else {
                      Swal.fire('Error', response.data.message, 'error');
                  }
              } catch (error) {
                  console.error('Error:', error);
                  Swal.fire('Error', 'Failed to delete address', 'error');
              }
          }
      }
  });
});

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

function removeAddressCard(addressId) {
  const addressCard = document.querySelector(`[data-id="${addressId}"]`).closest('.col-md-6');
  if (addressCard) {
      addressCard.remove();
  }
}
