class CustomerManager {
  constructor() {
    this.currentPage = 1;
    this.limit = parseInt(document.getElementById('itemsPerPage').value) || 10;
    this.search = document.getElementById('searchInput').value || '';
    this.status = document.getElementById('statusFilter').value || '';
    this.totalPages = 1;

    this.initEventListeners();
    this.fetchCustomers();
}

  initEventListeners() {
      document.getElementById('searchInput').addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
      document.getElementById('statusFilter').addEventListener('change', this.handleStatusChange.bind(this));
      document.getElementById('itemsPerPage').addEventListener('change', this.handleLimitChange.bind(this));
  }

  async fetchCustomers() {
      try {
          const response = await axios.get('/admin/customers', {
              params: {
                  page: this.currentPage,
                  limit: this.limit,
                  search: this.search,
                  status: this.status
              }
          });
          this.updateCustomerList(response.data.userData);
          this.updatePagination(response.data);
      } catch (error) {
          console.error('Error fetching customers:', error);
          Swal.fire('Error', 'Failed to fetch customers', 'error');
      }
  }

  updateCustomerList(customers) {
      const container = document.getElementById('customerListContainer');
      container.innerHTML = this.generateCustomerTable(customers);
  }

  generateCustomerTable(customers) {
      if (customers.length === 0) {
          return '<p class="text-center">No Users Found Yet</p>';
      }

      return `
          <table class="table table-hover">
              <thead>
                  <tr>
                      <th>Sl.No.</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Reg.Date</th>
                      <th class="text-center">Action</th>
                  </tr>
              </thead>
              <tbody>
                  ${customers.map((user, index) => this.generateCustomerRow(user, index)).join('')}
              </tbody>
          </table>
      `;
  }

  generateCustomerRow(user, index) {
      return `
          <tr>
              <td>${index + 1}</td>
              <td>${user.firstName} ${user.lastName}</td>
              <td>${user.email}</td>
              <td>${user.mobile}</td>
              <td>${new Date(user.createdAt).toLocaleString()}</td>
              <td class="text-end">
                  <div class="d-flex justify-content-end">
                      <button onclick="customerManager.softDeleteUser('${user._id}')" 
                              id="softDeleteButton${user._id}" 
                              class="btn ${user.isBlocked ? 'btn-success' : 'btn-danger'} rounded btn-sm font-sm flex-fill mx-1">
                          ${user.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                  </div>
              </td>
          </tr>
      `;
  }

  updatePagination(data) {
      this.currentPage = data.currentPage;
      this.totalPages = data.totalPages;
      const pagination = document.getElementById('pagination');
      pagination.innerHTML = '';

      this.addPaginationButton(pagination, this.currentPage - 1, '«', this.currentPage > 1);

      for (let i = 1; i <= this.totalPages; i++) {
          this.addPaginationButton(pagination, i, i.toString(), true, i === this.currentPage);
      }

      this.addPaginationButton(pagination, this.currentPage + 1, '»', this.currentPage < this.totalPages);

      document.getElementById('customerCount').textContent = `Showing ${data.userData.length} of ${data.totalUsers} customers`;
  }

  addPaginationButton(container, page, text, isEnabled, isActive = false) {
      const li = document.createElement('li');
      li.className = `page-item ${isActive ? 'active' : ''} ${!isEnabled ? 'disabled' : ''}`;
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = text;
      if (isEnabled) {
          a.addEventListener('click', (e) => {
              e.preventDefault();
              this.currentPage = page;
              this.fetchCustomers();
          });
      }
      li.appendChild(a);
      container.appendChild(li);
  }

  handleSearch() {
      this.search = document.getElementById('searchInput').value;
      this.currentPage = 1;
      this.fetchCustomers();
  }

  handleStatusChange() {
      this.status = document.getElementById('statusFilter').value;
      this.currentPage = 1;
      this.fetchCustomers();
  }

  handleLimitChange() {
      this.limit = parseInt(document.getElementById('itemsPerPage').value);
      this.currentPage = 1;
      this.fetchCustomers();
  }

  async softDeleteUser(userId) {
      try {
          const response = await axios.patch(`/admin/customers?userId=${userId}`);
          if (response.data.success) {
              this.fetchCustomers();
              Swal.fire('Success', response.data.message, 'success');
          } else {
              throw new Error(response.data.message);
          }
      } catch (error) {
          console.error('Error toggling user status:', error);
          Swal.fire('Error', 'Failed to update user status', 'error');
      }
  }

  debounce(func, delay) {
      let timeoutId;
      return function (...args) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
  }
}

const customerManager = new CustomerManager();
