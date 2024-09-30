document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', handleWishlistClick);
  if (window.location.pathname === '/wishlist') {
    loadWishlistItems();
  }
});

function handleWishlistClick(event) {
  const target = event.target.closest('.add-to-wishlist');
  if (target) {
    event.preventDefault();
    event.stopPropagation();
    const productId = target.dataset.productId;
    if (productId) {
      debouncedAddToWishlist(productId, target);
    }
  }
}


function addToWishlist(productId, button) {
  axios.post('/add-to-wishlist', { productId })
    .then(response => {
      if (response.data.success) {
        if (response.data.added) {
          showSuccess('Product added to wishlist');
          button.classList.add('added-to-wishlist');
        } else {
          showSuccess('Product removed from wishlist');
          button.classList.remove('added-to-wishlist');
        }
        if (window.location.pathname === '/wishlist') {
          loadWishlistItems();
        }
      } else {
        showError('Failed to update wishlist');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('An error occurred while updating wishlist');
    });
}


function loadWishlistItems() {
  axios.get('/wishlist-items')
    .then(response => {
      const wishlistTable = document.querySelector('.wishlish-table-wrapper tbody');
      wishlistTable.innerHTML = '';
      response.data.forEach(item => {
        const row = createWishlistItemRow(item);
        wishlistTable.appendChild(row);
      });
    })
    .catch(error => {
      console.error('Error:', error);
      showError('An error occurred while loading wishlist items');
    });
}

function createWishlistItemRow(item) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="product_remove"><a href="#" onclick="removeFromWishlist('${item.productId}')"><i class="fa fa-trash-o"></i></a></td>
    <td class="product_thumb"><a href="/product/${item.productId}"><img src="${item.image}" alt="${item.name}"></a></td>
    <td class="product_name"><a href="/product/${item.productId}">${item.name}</a></td>
    <td class="product-price">₹${item.price.toFixed(2)}</td>
    <td class="product_status">${item.stockAvailability ? 'In Stock' : 'Out of Stock'}</td>
    <td class="product_addcart"><a href="#" class="btn btn-md btn-golden" onclick="addToCart('${item.productId}')">Add To Cart</a></td>
  `;
  return row;
}

function removeFromWishlist(productId) {
  axios.put('/remove-from-wishlist', { productId })
    .then(response => {
      if (response.data.success) {
        showSuccess('Product removed from wishlist');
        if (window.location.pathname === '/wishlist') {
          loadWishlistItems();
        }
      } else {
        showError('Failed to remove product from wishlist');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('An error occurred while removing from wishlist');
    });
}

function moveToCart(productId) {
  axios.post('/add-to-cart', { productId })
    .then(response => {
      if (response.data.success) {
        removeFromWishlist(productId);
        showSuccess('Product moved to cart');
      } else {
        showError('Failed to move product to cart');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showError('An error occurred while moving to cart');
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

const debouncedAddToWishlist = debounce(addToWishlist, 300);