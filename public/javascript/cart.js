document.querySelectorAll('.product_remove a').forEach(button => {
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    const row = e.target.closest('tr');
    const productId = row.dataset.productId;

    if (!isValidObjectId(productId)) {
      Swal.fire({
        title: 'Error',
        text: 'Invalid product ID',
        icon: 'error'
      });
      return;
    }

    async function isValidObjectId(id) {
      try {
        return await mongoose.Types.ObjectId.isValid(id);
      } catch (error) {
        return false;
      }
    }

    // Show a confirmation popup
    const confirmed = await Swal.fire({
      title: 'Are you sure?',
      text: 'You wont be able to revert this!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (confirmed.isConfirmed) {
      try {
        const response = await axios.post('/removeFromCart', { productId: productId });
        if (response.data.success) {
          row.remove();
          updateCartTotals();
        } else {
          Swal.fire({
            title: 'Error',
            text: response.data.message,
            icon: 'error'
          });
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          title: 'Error',
          text: 'Failed to remove item',
          icon: 'error'
        });
      }
    }
  });

  // Handle quantity change
  document.querySelectorAll('.product_quantity input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const row = e.target.closest('tr');
      const productId = row.dataset.productId;
      const quantity = e.target.value;
      try {
        const response = await fetch('/updateCart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ productId: productId, quantity: quantity })
        });
        if (response.ok) {
          const price = parseFloat(row.querySelector('.product-price').textContent.replace('₹', ''));
          const total = row.querySelector('.product_total');
          total.textContent = `₹${(price * quantity).toFixed(2)}`;
          updateCartTotals();
        } else {
          alert('Failed to update quantity');
        }
      } catch (err) {
        console.error(err);
        alert('Error updating quantity');
      }
    });
  });
});

function updateTotalPrice(event) {
  const input = event.target;
  const row = input.closest('tr');
  const quantity = parseInt(input.value, 10);
  const totalPriceCell = row.querySelector('.product_total');
  const priceElement = row.querySelector('.product-price');
  const productPrice = parseFloat(priceElement.textContent.replace('₹', ''));

  if (isNaN(productPrice)) {
    console.error('Invalid product price:', priceElement.textContent);
    return;
  }

  const totalPrice = productPrice * quantity;
  totalPriceCell.textContent = `₹${totalPrice.toFixed(2)}`;

  updateCartTotals();
}

function updateCartTotals() {
  let subtotal = 0;
  const subtotalElement = document.querySelector('.cart_subtotal .cart_amount');
  const shippingElement = document.querySelector('.cart_subtotal .cart_amount span');
  const totalElement = document.querySelector('.cart_subtotal .cart_amount.total');

  if (!subtotalElement || !shippingElement || !totalElement) {
    console.error('One or more cart total elements not found');
    return;
  }

  const productTotalCells = document.querySelectorAll('.product_total');
  productTotalCells.forEach(cell => {
    const totalPriceText = cell.textContent.replace('₹', '');
    const totalPrice = parseFloat(totalPriceText);

    if (!isNaN(totalPrice)) {
      subtotal += totalPrice;
    } else {
      console.error('Invalid total price:', totalPriceText);
    }
  });

  const shipping = 25.00;
  const total = subtotal + shipping;

  subtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
  shippingElement.textContent = `${shipping.toFixed(2)}`;
  totalElement.textContent = `₹${total.toFixed(2)}`;
}


