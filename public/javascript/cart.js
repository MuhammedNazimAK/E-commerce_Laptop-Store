document.addEventListener('DOMContentLoaded', function() {
    const removeButtons = document.querySelectorAll('.product_remove a');
    const quantityInputs = document.querySelectorAll('.product_quantity input');
    const applyCouponButton = document.getElementById('apply-coupon');
    const viewCouponsButton = document.getElementById('view-coupons');
    const removeCouponButton = document.getElementById('remove-coupon');
  
    removeButtons.forEach(button => {
      button.addEventListener('click', removeProduct);
    });
  
    quantityInputs.forEach(input => {
      input.addEventListener('change', updateQuantity);
    });
  
    applyCouponButton.addEventListener('click', applyCoupon);
    removeCouponButton.addEventListener('click', removeCoupon);
    viewCouponsButton.addEventListener('click', viewAvailableCoupons);
  
    updateCartTotals();
  });
  
  async function removeProduct(e) {
    e.preventDefault();
    const row = e.target.closest('tr');
    const productId = row.dataset.productId;
  
    const confirmed = await Swal.fire({
      title: 'Are you sure?',
      text: 'You won\'t be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });
  
    if (confirmed.isConfirmed) {
      try {
        const response = await axios.post('/removeFromCart', { productId });
        if (response.data.success) {
          row.remove();
          updateItemCounts();
          updateCartTotals();
          showSuccess('Item removed successfully');
        } else {
          showError(response.data.message || 'Failed to remove item');
        }
      } catch (err) {
        console.error(err);
        showError('Failed to remove item');
      }
    }
  }
  
  async function updateQuantity(e) {
    const row = e.target.closest('tr');
    const productId = row.dataset.productId;
    const quantity = parseInt(e.target.value);
  
    if (quantity > 5) {
      showError('Quantity cannot exceed 5 for this item');
      e.target.value = 5;
      return;
    }

    try {
      const response = await axios.post('/updateCart', { productId, quantity });
      if (response.data.success) {
        const price = parseFloat(row.querySelector('.product-price').textContent.replace('₹', ''));
        const total = row.querySelector('.product_total');
        total.textContent = `₹${(price * quantity).toFixed(2)}`;
        updateCartTotals();
      } else {
        showError(response.data.message || 'Failed to update quantity');
        e.target.value = response.data.quantity;
      }
    } catch (err) {
      console.error(err);
      showError('Failed to update quantity');
      e.target.value = e.target.defaultValue;
    }
  }
  
  async function applyCoupon() {
    const couponCode = document.getElementById('coupon-input').value;
    try {
      const response = await axios.post('/apply-coupon', { couponCode }, { withCredentials: true });
      if (response.data.success) {
        const discountedAmount = response.data.discountAmount;
        const cartTotal = response.data.cartTotal;
        updateCartTotals(discountedAmount, cartTotal);
        showAppliedCoupon(couponCode, discountedAmount);
        showSuccess('Coupon applied successfully');
      } else {
        showError(response.data.message || 'Failed to apply coupon');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to apply coupon');
    }
  }
  
  async function removeCoupon() {
    try {
      const response = await axios.post('/remove-coupon');
      if (response.data.success) {
        updateCartTotals(0);
        hideAppliedCoupon();
        showSuccess('Coupon removed successfully');
      } else {
        showError(response.data.message || 'Failed to remove coupon');
      }
    } catch (err) {
      console.error(err);
      showError('Failed to remove coupon');
    }
  }
  
  async function viewAvailableCoupons() {
    try {
      const response = await axios.get('/available-coupons');
      if (response.data.success) {
        const couponsHtml = response.data.coupons.map(coupon => 
          `<p>${coupon.code}: ${coupon.description}</p>`
        ).join('');
        
        Swal.fire({
          title: 'Available Coupons',
          html: couponsHtml,
          icon: 'info'
        });
      } else {
        Swal.fire('Error', 'Failed to fetch available coupons', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to fetch available coupons', 'error');
    }
  }
  
  function showAppliedCoupon(couponCode, discount) {
    document.getElementById('applied-coupon-code').textContent = couponCode;
    document.getElementById('applied-coupon-discount').textContent = `${discount.toFixed(2)} off`;  
    document.getElementById('applied-coupon').style.display = 'flex';
    document.getElementById('coupon-input').value = '';
    document.getElementById('coupon-input').disabled = true;
    document.getElementById('apply-coupon').disabled = true;
    document.getElementById('remove-coupon').style.display = 'block';
  }
  
  function hideAppliedCoupon() {
    document.getElementById('applied-coupon').style.display = 'none';
    document.getElementById('coupon-input').disabled = false;
    document.getElementById('apply-coupon').disabled = false;
  }
  
  function updateCartTotals(discount = 0, cartTotal = null) {
    let subtotal = 0;
  
    if (cartTotal === null) {
      // Calculate subtotal from product totals
      const productTotalCells = document.querySelectorAll('.product_total');
      
      productTotalCells.forEach(cell => {
        const totalPrice = parseFloat(cell.textContent.replace('₹', '').trim());
        if (!isNaN(totalPrice)) {
          subtotal += totalPrice;
        }
      });
    } else {
      // Use the provided cartTotal
      subtotal = cartTotal;
    }
  
    const shipping = parseFloat(document.getElementById('shipping').textContent.replace('₹', '').trim()) || 0;
    const total = Math.max(0, subtotal + shipping - discount);
  
    document.getElementById('subtotal').textContent = `${subtotal.toFixed(2)}`;
    document.getElementById('total').textContent = `${total.toFixed(2)}`;
  
    if (discount > 0) {
      document.getElementById('discount').textContent = `${discount.toFixed(2)}`;
      document.getElementById('discount-row').style.display = 'table-row';
    } else {
      document.getElementById('discount-row').style.display = 'none';
    }
  
    // Update shipping display
    document.getElementById('shipping').textContent = `${shipping.toFixed(2)}`;
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
  
  document.querySelectorAll('.product_quantity input').forEach(input => {
    input.style.width = '60px';
    input.style.height = '40px';
    input.style.fontSize = '16px';
    input.style.textAlign = 'center';
  });
  