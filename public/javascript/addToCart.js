const addToCarts = async (productId) => {
  const quantity = document.getElementById("quantity").value || 1;

  try {
    const addToCartResponse = await fetch(`http://localhost:3000/addToCart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, quantity }),
    });

    if (!addToCartResponse.ok) {
      throw new Error("Failed to add product to cart");
    }

    const productDetails = await fetch(`http://localhost:3000/productDetails/${productId}`);

    if (!productDetails.ok) {
      throw new Error("Failed to fetch product details");
    }

    const data = await productDetails.json();
    console.log('data',data);

    document.getElementById('modalProductImage').src = data.images.highResolutionPhotos[0];
    document.getElementById('modalProductName').textContent = data.basicInformation.name;
    document.getElementById('modalProductPrice').textContent = data.pricingAndAvailability.salesPrice;
    document.getElementById('modalProductQuantity').textContent = quantity;
    document.getElementById('modalProductTotalPrice').textContent = data.pricingAndAvailability.salesPrice * quantity;
  } catch (error) {
    console.error("Error:", error);
  }
};