document.addEventListener('DOMContentLoaded', function() {
  fetchOrders(1);
  fetchWalletTransactions(1);
});

async function fetchOrders(page) {
  try {
    const response = await axios.get(`/orders?page=${page}`);
    const { orders, currentPage, totalPages } = response.data;
    window.ordersData = JSON.stringify(orders);
    updateOrdersTable(orders);
    updatePagination('ordersPagination', currentPage, totalPages, fetchOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    showError('Failed to show orders');
  }
}

function updateOrdersTable(orders) {
  const tableBody = document.getElementById('orderTableBody');
  if (orders.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="5">No orders found</td></tr>';
    return;
  }

  tableBody.innerHTML = orders.map(order => `
    <tr>
      <td>${order.orderId}</td>
      <td>${new Date(order.createdAt).toDateString()}</td>
      <td>${order.status}</td>
      <td>₹${order.total.toFixed(2)}</td>
      <td class="action-buttons">
        <button onclick="viewOrderDetails('${order._id}')" class="btn btn-md btn-black-default-hover">View</button>
        ${getActionButton(order)}
      </td>
    </tr>
  `).join('');
}

async function viewOrderDetails(orderId) {
  const orders = JSON.parse(window.ordersData);
  const order = orders.find(o => o._id === orderId);

  if (!order) {
    console.error('Order not found:', orderId);
    showError('Failed to fetch order details');
    return;
  }

  document.getElementById('orderId').textContent = order.orderId;
  document.getElementById('orderDate').textContent = new Date(order.createdAt).toLocaleString();
  document.getElementById('orderStatus').textContent = order.status;
  document.getElementById('orderTotal').textContent = order.total.toFixed(2);
  document.getElementById('orderPayment').textContent = order.paymentMethod;
  
  const modalFooter = document.querySelector('#orderDetailsModal .modal-footer');
  
  const existingDownloadButton = modalFooter.querySelector('.download-invoice-btn');
  if (existingDownloadButton) {
    existingDownloadButton.remove();
  }

  if (order.status !== 'Pending') {
    const downloadButton = document.createElement('a');
    downloadButton.href = `/download-invoice/${orderId}`;
    downloadButton.className = 'btn btn-md btn-black-default-hover download-invoice-btn';
    downloadButton.textContent = 'Download Invoice';
    modalFooter.appendChild(downloadButton);
  }

  // Fetch address details
  try {
    const addressResponse = await axios.get(`/address/${order.shippingAddress}`);
    const shippingAddress = addressResponse.data;

    const formattedAddress = shippingAddress ? 
      `${shippingAddress.name}, 
      ${shippingAddress.addressType},
      ${shippingAddress.landMark},
      ${shippingAddress.city},
      ${shippingAddress.state} - ${shippingAddress.pinCode},
      Mobile: ${shippingAddress.mobile}` 
      : 'Address not available';
    document.getElementById('orderShippingAddress').textContent = formattedAddress;
  } catch (error) {
    console.error('Error fetching address:', error);
    document.getElementById('orderShippingAddress').textContent = 'Address not available';
  }

  const itemsTableBody = document.getElementById('orderItemsTableBody');
  itemsTableBody.innerHTML = order.products.map(item => `
    <tr>
      <td>${item.product.basicInformation.name}</td>
      <td>${item.quantity}</td>
      <td>₹${item.price.toFixed(2)}</td>
      <td>₹${(item.price * item.quantity).toFixed(2)}</td>
      <td>${getProductReturnButton(order, item)}</td>
    </tr>
  `).join('');

  const modal = new bootstrap.Modal(document.getElementById('orderDetailsModal'));
  modal.show();
}

function getProductReturnButton(order, item) {
  if (order.status === 'Delivered' && item.returnStatus === 'Not Returned') {
    return `<button onclick="returnProduct('${order._id}', '${item.product._id}')" class="btn btn-sm btn-black-default-hover">Return</button>`;
  } else if (item.returnStatus !== 'Not Returned') {
    return `<span>${item.returnStatus}</span>`;
  }
  return '';
}

function getActionButton(order) {
   if (order.status === 'Pending' && order.paymentMethod === 'razorpay') {
    return `<a href="/retry-checkout/${order._id}" class="btn btn-md btn-black-default-hover">Retry Payment</a>`;
  } else if (order.status === 'Pending') {
    return `<button onclick="cancelOrder('${order._id}')" class="btn btn-md btn-black-default-hover">Cancel</button>`;
  } else {
    return '';
  }
}

function cancelOrder(orderId) {
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to cancel this order?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, cancel it!'
  }).then((result) => {
    if (result.isConfirmed) {
      axios.put(`/my-account/cancel-order/${orderId}`)
        .then(response => {
          if (response.data.success) {
            Swal.fire('Cancelled!', 'Your order has been cancelled.', 'success');
            updateOrderStatus(orderId, 'Cancelled');
          } else {
            Swal.fire('Error', response.data.message || 'Failed to cancel order', 'error');
          }
        })
        .catch(error => {
          console.error('Error cancelling order:', error);
          Swal.fire('Error', error.response?.data?.message || 'Failed to cancel order', 'error');
        });
    }
  });
}

<<<<<<< HEAD

function returnOrder(orderId) {
  if (confirm('Are you sure you want to return this order?')) {
    axios.put(`/my-account/return-order/${orderId}`)
=======
function returnProduct(orderId, productId) {
  const orderDetailsModal = bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal'));
  const confirmReturnModal = new bootstrap.Modal(document.getElementById('confirmReturnModal'));

  // Show the confirm return modal without hiding the order details modal
  confirmReturnModal.show();

  document.getElementById('confirmReturnBtn').onclick = function() {
    confirmReturnModal.hide();
    axios.put(`/my-account/return-product/${orderId}`, { productId })
>>>>>>> 8b8d0b1f4dbeb2cd05ef9b8baccfe3055e30f7ee
      .then(response => {
        if (response.data.success) {
          orderDetailsModal.hide();
          confirmReturnModal.hide();
          showSuccess('Return request submitted successfully');
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          updateProductReturnStatus(orderId, productId, 'Return Requested');
        } else {
          showError(response.data.message || 'Failed to request return');
        }
      })
      .catch(error => {
        console.error('Error requesting return:', error);
        showError(error.response?.data?.message || 'Failed to request return');
      });
  };

  document.getElementById('confirmReturnModal').removeEventListener('hidden.bs.modal', orderDetailsModal.show);
}

function updateProductReturnStatus(orderId, productId, newStatus) {
  const orderItemsTableBody = document.getElementById('orderItemsTableBody');
  const productRow = orderItemsTableBody.querySelector(`tr[data-product-id="${productId}"]`);
  if (productRow) {
    const actionCell = productRow.querySelector('td:last-child');
    actionCell.innerHTML = `<span>${newStatus}</span>`;
  }
}

function updateOrderStatus(orderId, newStatus) {
  const orders = JSON.parse(window.ordersData);
  const updatedOrders = orders.map(order => {
    if (order.orderId === orderId) {
      return { ...order, status: newStatus };
    }
    return order;
  });
  window.ordersData = JSON.stringify(updatedOrders);
  fetchOrders();
}

function updatePagination(containerId, currentPage, totalPages, fetchFunction) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === currentPage ? 'active' : ''}`;
    
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = i;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      fetchFunction(i);
    });

    li.appendChild(a);
    container.appendChild(li);
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
