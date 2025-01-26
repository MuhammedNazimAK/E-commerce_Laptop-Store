document.addEventListener('DOMContentLoaded', function() {
  updateBalance();
});

async function fetchWalletTransactions(page) {
  try {
    const response = await axios.get(`/transactions?page=${page}`);
    const { transactions, currentPage, totalPages } = response.data;
    
    updateTransactionsTable(transactions);
    updatePagination('walletPagination', currentPage, totalPages, fetchWalletTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}

function updateTransactionsTable(transactions) {
  const transactionTable = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];
  transactionTable.innerHTML = '';
  transactions.forEach(transaction => {
    const row = transactionTable.insertRow();
    row.insertCell(0).textContent = new Date(transaction.createdAt).toLocaleString();
    row.insertCell(1).textContent = transaction.type;
    row.insertCell(2).textContent = `₹${transaction.amount.toFixed(2)}`;
    row.insertCell(3).textContent = transaction.status;
    row.insertCell(4).textContent = transaction.description;
  });
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


const walletBalance = document.getElementById('walletBalance');
const transactionTable = document.getElementById('transactionTable').getElementsByTagName('tbody')[0];

async function updateBalance() {
  try {
    const response = await axios.get('/balance');
    walletBalance.textContent = `Current Balance: ₹${response.data.balance.toFixed(2)}`;
  } catch (error) {
    console.error('Error fetching balance:', error);
  }
}

async function getTransactions(page = 1) {
  try {
    const response = await axios.get(`/transactions?page=${page}`);
    const { transactions, currentPage, totalPages } = response.data;
    
    if (!Array.isArray(transactions)) {
      throw new Error('Invalid response format: transactions is not an array');
    }

    transactionTable.innerHTML = '';
    transactions.forEach(transaction => {
      const row = transactionTable.insertRow();
      row.insertCell(0).textContent = new Date(transaction.createdAt).toLocaleString();
      row.insertCell(1).textContent = transaction.type;
      row.insertCell(2).textContent = `₹${transaction.amount.toFixed(2)}`;
      row.insertCell(3).textContent = transaction.status;
      row.insertCell(4).textContent = transaction.description;
    });

    // Update pagination if needed
    if (typeof updatePagination === 'function') {
      updatePagination('walletPagination', currentPage, totalPages, getTransactions);
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    showError('Failed to fetch transactions. Please try again later.');
  }
}


updateBalance();
getTransactions();


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