(function () {
class ProductData {
  constructor() {
    this.filters = {
      minPrice: 0,
      maxPrice: Infinity,
      brands: [],
      rams: [],
      processors: [],
      graphicsCards: [],
      minRating: 0,
      featured: false,
      newArrivals: false
    };
    this.sortOption = 'createdAt';
    this.currentPage = 1;
    this.itemsPerPage = 9;

    this.initEventListeners();
    this.initPriceSlider();
    this.fetchProducts();
  }

  initEventListeners() {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('#search-form button[type="submit"]');

    if (searchForm && searchInput && searchButton) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSearch(searchInput.value);
      }); 

      searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSearch(searchInput.value);
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        console.log('sortSelect.value:', e.target.value);
        this.sortOption = e.target.value;
        this.currentPage = 1;
        this.fetchProducts();
      });
    }

    document.querySelectorAll('.brand-filter, .ram-filter, .processor-filter, .graphics-card-filter')
      .forEach(checkbox => {
        checkbox.addEventListener('change', () => this.updateFilters());
      });

    const ratingFilter = document.getElementById('rating-filter');
    if (ratingFilter) {
      ratingFilter.addEventListener('input', (e) => {
        this.filters.minRating = parseFloat(e.target.value);
        this.fetchProducts();
      });
    }

    const featuredFilter = document.getElementById('featured-filter');
    if (featuredFilter) {
      featuredFilter.addEventListener('change', (e) => {
        this.filters.featured = e.target.checked;
        this.fetchProducts();
      });
    }

    const newArrivalsFilter = document.getElementById('new-arrivals-filter');
    if (newArrivalsFilter) {
      newArrivalsFilter.addEventListener('change', (e) => {
        this.filters.newArrivals = e.target.checked;
        this.fetchProducts();
      });
    }
  }

  initPriceSlider() {
    const slider = document.getElementById('slider-range');
    const minPriceInput = document.getElementById('min-price');
    const maxPriceInput = document.getElementById('max-price');

    if (slider && minPriceInput && maxPriceInput) {
      if (!slider.noUiSlider) {
      noUiSlider.create(slider, {
        start: [0, 500000],
        connect: true,
        range: {
          'min': 0,
          'max': 500000
        }
      });
    }

      slider.noUiSlider.on('update', (values, handle) => {
        const value = Math.round(values[handle]);
        if (handle === 0) {
          minPriceInput.value = value;
          this.filters.minPrice = value;
        } else {
          maxPriceInput.value = value;
          this.filters.maxPrice = value;
        }
      });

      slider.noUiSlider.on('change', () => this.fetchProducts());
    }
  }

  updateFilters() {
    this.filters.brands = [...document.querySelectorAll('.brand-filter:checked')].map(el => el.value);
    this.filters.rams = [...document.querySelectorAll('.ram-filter:checked')].map(el => el.value);
    this.filters.processors = [...document.querySelectorAll('.processor-filter:checked')].map(el => el.value);
    this.filters.graphicsCards = [...document.querySelectorAll('.graphics-card-filter:checked')].map(el => el.value);
    this.currentPage = 1;
    this.fetchProducts();
  }

  updatePagination(totalProducts) {
    const totalPages = Math.ceil(totalProducts / this.itemsPerPage);
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';
  
    // Previous page button
    const prevButton = document.createElement('li');
    prevButton.className = `page-item ${this.currentPage === 1 ? 'disabled' : ''}`;
    prevButton.innerHTML = '<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>';
    prevButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.currentPage > 1) {
        this.currentPage--;
        this.fetchProducts();
      }
    });
    paginationContainer.appendChild(prevButton);
  
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageItem = document.createElement('li');
      pageItem.className = `page-item ${i === this.currentPage ? 'active' : ''}`;
      pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
      pageItem.addEventListener('click', (e) => {
        e.preventDefault();
        this.currentPage = i;
        this.fetchProducts();
      });
      paginationContainer.appendChild(pageItem);
    }
  
    // Next page button
    const nextButton = document.createElement('li');
    nextButton.className = `page-item ${this.currentPage === totalPages ? 'disabled' : ''}`;
    nextButton.innerHTML = '<a class="page-link" href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>';
    nextButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.fetchProducts();
      }
    });
    paginationContainer.appendChild(nextButton);
  }

  handleSearch(query) {
    this.searchQuery = query;
    this.currentPage = 1;
    this.fetchProducts();

    const searchModal = document.getElementById('search');
    if (searchModal) {
      searchModal.classList.remove('open');
    }

    //clear the search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
    }
  }

  async fetchProducts() {
    console.log('Fetching products with sort option:', this.sortOption);
    try {
      const response = await fetch('/productListing/search-and-sort', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filters: this.filters,
          sort: this.sortOption,
          page: this.currentPage,
          itemsPerPage: this.itemsPerPage,
          searchQuery: this.searchQuery
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      this.updateProductContainer(data.products);
      this.updatePagination(data.totalProducts);
      this.currentPage = data.currentPage;

      this.updateURL();

      const productCountElement = document.getElementById('product-count');
      if (productCountElement) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(this.currentPage * this.itemsPerPage, data.totalProducts);
        productCountElement.textContent = `Showing ${startIndex}-${endIndex} of ${data.totalProducts} results`;
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }

    updateURL() {
    const searchParams = new URLSearchParams();
    searchParams.set('page', this.currentPage);
    searchParams.set('sort', this.sortOption);
    if (this.searchQuery) searchParams.set('searchQuery', this.searchQuery);

    Object.entries(this.filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        searchParams.set(key, value.join(','));
      } else if (typeof value === 'boolean' && value) {
        searchParams.set(key, 'true');
      } else if (typeof value === 'number' && value > 0) {
        searchParams.set(key, value.toString());
      }
    });

    window.history.pushState({}, '', `${window.location.pathname}?${searchParams.toString()}`); 
  }

   updateProductContainer(products) {
    const container = document.getElementById('product-container');
    if (!container) return;
    container.innerHTML = '';
    
    products.forEach(product => {
      const productElement = document.createElement('div');
      productElement.classList.add('product-list-single', 'product-color--golden', 'fade-in-element');
      const truncatedDescription = truncateString(product.basicInformation.description, 150);
      const isUnavailable = product.status === false;
      
      productElement.innerHTML = `
        <a href="/productDetails/${product._id}" class="product-list-img-link">
          <img class="img-fluid" src="${product.images.highResolutionPhotos[0]}" alt="${product.basicInformation.name}" style="width: 350px; height: 350px; object-fit: contain;">
          <img class="img-fluid" src="${product.images.highResolutionPhotos[1] || product.images.highResolutionPhotos[0]}" alt="${product.basicInformation.name}" style="width: 350px; height: 350px; object-fit: contain;">
        </a>
        <div class="product-list-content">
          <h5 class="product-list-link"><a href="/productDetails/${product._id}">${product.basicInformation.name}</a></h5>
          <ul class="review-star">
            ${generateRatingStars()}
          </ul>
          ${isUnavailable ?
            '<span class="product-unavailable">Currently Unavailable</span>' :
            `<span class="product-list-price">
              ${product.pricingAndAvailability.salesPrice ?
                `<del>₹${product.pricingAndAvailability.regularPrice}</del> ₹${product.pricingAndAvailability.salesPrice}` :
                `₹${product.pricingAndAvailability.regularPrice}`}
             </span>`
          }
          <p>${truncatedDescription}</p>
          <div class="product-action-icon-link-list">
            ${isUnavailable ? '' : `
              <a href="/addToCart/${product._id}" data-bs-toggle="modal" data-bs-target="#modalAddcart" class="btn btn-lg btn-black-default-hover">Add to cart</a>
              <a href="wishlist.html" class="btn btn-lg btn-black-default-hover"><i class="icon-heart"></i></a>
            `}
          </div>
        </div>
      `;
      container.appendChild(productElement);
    });
  
  
    const event = new CustomEvent('productsUpdated', { detail: products });
    document.dispatchEvent(event);
  }
}
  function generateRatingStars() {
    return `
      <li class="fill"><i class="ion-android-star"></i></li>
      <li class="fill"><i class="ion-android-star"></i></li>
      <li class="fill"><i class="ion-android-star"></i></li>
      <li class="fill"><i class="ion-android-star"></i></li>
      <li class="empty"><i class="ion-android-star"></i></li>
    `;
  }
  
  function truncateString(str, maxLength) {
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '...';
    }
    return str;
  }

document.addEventListener('DOMContentLoaded', () => {
  new ProductData();
});
})(); 