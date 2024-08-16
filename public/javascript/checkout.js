document.addEventListener("DOMContentLoaded", () => {
  const addressListContainer = document.getElementById("addressList");
  console.log("addressListContainer", addressListContainer);
  const addressForm = document.getElementById("addressForm");
  const editAddressForm = document.getElementById("editAddressForm");
  const addressIdInput = document.getElementById("addressId");
  const placeOrderButton = document.getElementById("placeOrder");

  console.log("DOM content loaded", addEventListener);

  // Function to fetch and display user addresses
  function fetchAddresses() {
    console.log("fetchAddresses called");

    fetch("/my-account/add-address")
      .then((response) => response.json())
      .then((data) => {
        console.log("data", data);
        const addresses = data.addresses.address;
        if (addresses && addresses.length > 0) {
          addressListContainer.innerHTML = addresses
            .map(
              (address, index) => `
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
                  <a onclick="editAddress('${address._id}', '${address.addressType}', '${address.name}', '${address.mobile}', '${address.address}', '${address.city}', '${address.state}', '${address.pinCode}', '${address.landMark}')" class="dropdown-item">Edit info</a>
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
          addressListContainer.innerHTML =
            "<p>No addresses available. Please add a new address.</p>";
        }
      })

      .catch((error) => {
        console.error("Error:", error);
        Swal.fire({
          icon: "error",
          text: `An error occurred while fetching addresses: ${error.message}`,
          toast: true,
          position: "top-right",
          showConfirmButton: false,
          timerProgressBar: true,
          timer: 3000,
        });
      });
  }

  // Load user addresses on page load
  fetchAddresses();

  // Show/Hide Address Form
  document.getElementById("showButton").addEventListener("click", () => {
    addressForm.style.display =
      addressForm.style.display === "none" ? "block" : "none";
  });

  // Place Order
  placeOrderButton.addEventListener("click", () => {
    const selectedAddressId = getSelectedAddressId();
    const couponCode = document.getElementById("couponCode")
      ? document.getElementById("couponCode").value
      : "";

    if (!selectedAddressId) {
      Swal.fire({
        icon: "error",
        text: "Please select an address.",
        toast: true,
        position: "top-right",
        showConfirmButton: false,
        timerProgressBar: true,
        timer: 3000,
      });
    } else {
      fetch("http://localhost:3000/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentMethod: "cashOnDelivery",
          addressId: selectedAddressId,
          couponCode: couponCode,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire({
              icon: "success",
              text: "Order placed successfully!",
              toast: true,
              position: "top-right",
              showConfirmButton: false,
              timerProgressBar: true,
              timer: 3000,
            }).then(() => {
              window.location.href = "http://localhost:3000/placeOrder";
            });
          }
        })
        .catch((error) => {
          Swal.fire({
            icon: "error",
            text: `An error occurred: ${error.message}`,
            toast: true,
            position: "top-right",
            showConfirmButton: false,
            timerProgressBar: true,
            timer: 3000,
          });
        });
    }
  });

  function getSelectedAddressId() {
    const addressRadios = document.getElementsByName("addressSelection");
    let selectedAddressId = null;
    addressRadios.forEach((radio) => {
      if (radio.checked) {
        selectedAddressId = radio.getAttribute("data-address-id");
      }
    });
    return selectedAddressId;
  }
});

// Edit Address Function
function editAddress(
  id,
  addressType,
  name,
  mobile,
  address,
  city,
  state,
  pinCode,
  landMark
) {
  const editAddressForm = document.getElementById("editAddressForm");

  document.getElementById("editAddressId").value = id;
  document.getElementById("editAddressName").value = name;
  document.getElementById("editAddressType").value = addressType;
  document.getElementById("editCity").value = city;
  document.getElementById("editLandMark").value = landMark;
  document.getElementById("editState").value = state;
  document.getElementById("editPinCode").value = pinCode;
  document.getElementById("editMobile").value = mobile;
  document.getElementById("editAddress").value = address;

  editAddressForm.style.display = "block";
}

// Remove Address Function
function removeAddress(addressId) {
  Swal.fire({
    title: "Are you sure?",
    text: "You won't be able to revert this!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, delete it!",
  }).then((result) => {
    if (result.isConfirmed) {
      fetch(`/my-account/delete-address/${addressId}`, {
        method: "DELETE",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            Swal.fire("Deleted!", "Your address has been deleted.", "success");
            fetchAddresses();
          } else {
            Swal.fire("Error", data.message, "error");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          Swal.fire(
            "Error",
            "An error occurred while deleting the address.",
            "error"
          );
        });
    }
  });
}
