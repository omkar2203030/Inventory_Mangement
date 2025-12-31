const API_URL = "https://inventory-mangement-xzmu.onrender.com/api";

// Add CORS headers logging
console.log("Frontend loaded!");
console.log("API URL:", API_URL);
console.log("Current page:", window.location.href);

let html5QrcodeScanner = null;
let currentBarcode = "";
let currentProduct = null;
let showingLowStock = false;
let isScanning = false;

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadProducts();
  loadCategories();
  setupUploadHandler();
});

// Setup upload handler for alternative method
function setupUploadHandler() {
  const uploadInput = document.getElementById("uploadInput");
  uploadInput.addEventListener("change", handleUploadedImage);
}

// Handle uploaded image
async function handleUploadedImage(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (event) {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      await onScanSuccess(decodedText, null);
    } catch (err) {
      alert(
        "❌ Could not read barcode from image.\n\nTips:\n• Make sure barcode is clear and well-lit\n• Try taking photo from different angle\n• Ensure barcode is not blurry"
      );
    }
  };
  reader.readAsDataURL(file);

  // Reset input
  e.target.value = "";
}

// Load dashboard stats
async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const stats = await response.json();

    document.getElementById("totalProducts").textContent = stats.totalProducts;
    document.getElementById("totalValue").textContent =
      "₹" + stats.totalValue.toLocaleString("en-IN");
    document.getElementById("lowStock").textContent = stats.lowStockCount;
    document.getElementById("categories").textContent = stats.categoriesCount;
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// Load products list
async function loadProducts() {
  try {
    const url = showingLowStock
      ? `${API_URL}/products?lowStock=true`
      : `${API_URL}/products`;

    const response = await fetch(url);
    const products = await response.json();

    const listEl = document.getElementById("productsList");

    if (products.length === 0) {
      listEl.innerHTML = '<div class="loading">No products found</div>';
      return;
    }

    listEl.innerHTML = products
      .map(
        (p) => `
                    <div class="product-item" onclick="viewProduct('${
                      p.barcode
                    }')">
                        <div class="product-name">${p.name}</div>
                        <div class="product-meta">
                            ${p.category} • ₹${p.cost} • Stock: ${p.stock}
                            ${
                              p.stock <= p.minStock
                                ? ' <span class="low-stock">⚠️ Low</span>'
                                : ""
                            }
                        </div>
                    </div>
                `
      )
      .join("");
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

// Load categories for autocomplete
async function loadCategories() {
  try {
    const response = await fetch(`${API_URL}/categories`);
    const categories = await response.json();

    const datalist = document.getElementById("categoryList");
    datalist.innerHTML = categories
      .map((c) => `<option value="${c}">`)
      .join("");
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

// Toggle low stock filter
function toggleLowStock() {
  showingLowStock = !showingLowStock;
  const btn = document.getElementById("filterBtn");

  if (showingLowStock) {
    btn.textContent = "Show All";
    btn.classList.add("active");
  } else {
    btn.textContent = "Show Low Stock";
    btn.classList.remove("active");
  }

  loadProducts();
}

// Start scanning
function startScanning() {
  const scanBtn = document.getElementById("scanBtn");
  const scannerContainer = document.getElementById("scannerContainer");
  const statusDiv = document.getElementById("scannerStatus");

  scanBtn.style.display = "none";
  scannerContainer.classList.add("active");
  statusDiv.textContent = "Initializing camera...";

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 150 },
    aspectRatio: 1.777778,
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
    ],
  };

  html5QrcodeScanner = new Html5QrcodeScanner("reader", config, false);
  html5QrcodeScanner.render(onScanSuccess, onScanError);
  isScanning = true;
  statusDiv.textContent = "🔍 Scanning... Point camera at barcode";
}

// Stop scanning
function stopScanning() {
  const scanBtn = document.getElementById("scanBtn");
  const scannerContainer = document.getElementById("scannerContainer");

  if (html5QrcodeScanner && isScanning) {
    html5QrcodeScanner
      .clear()
      .then(() => {
        isScanning = false;
        scanBtn.style.display = "block";
        scannerContainer.classList.remove("active");
      })
      .catch((err) => {
        console.error("Error stopping scanner:", err);
        isScanning = false;
        scanBtn.style.display = "block";
        scannerContainer.classList.remove("active");
      });
  } else {
    scanBtn.style.display = "block";
    scannerContainer.classList.remove("active");
  }
}

// Handle scan success
async function onScanSuccess(decodedText, decodedResult) {
  stopScanning();
  currentBarcode = decodedText;

  console.log("Scanned barcode:", decodedText);
  console.log("Checking API at:", `${API_URL}/products/barcode/${decodedText}`);

  try {
    const response = await fetch(`${API_URL}/products/barcode/${decodedText}`);

    console.log("Response status:", response.status);
    console.log("Response OK:", response.ok);

    if (!response.ok) {
      throw new Error("Server error: " + response.status);
    }

    const data = await response.json();
    console.log("Server response:", data);

    if (data.exists) {
      console.log("Product exists - showing details");
      // Product exists - show details
      showProductDetails(data.product);
    } else {
      console.log("New product - showing form");
      // New product - show form to add it
      showAddProductForm(decodedText);
    }
  } catch (error) {
    console.error("Full error:", error);
    console.error("Error type:", error.name);
    console.error("Error message:", error.message);

    let helpText = "❌ Connection Error\n\n";

    if (error.message.includes("Failed to fetch")) {
      helpText += "🔴 Cannot reach server at http://localhost:3000\n\n";
      helpText += "Checklist:\n";
      helpText += "✓ Is server running? (Check terminal)\n";
      helpText += "✓ Are you at http://localhost:3000 (not file:///)?\n";
      helpText += "✓ Try opening: http://localhost:3000/api/stats\n\n";
      helpText += "Current page: " + window.location.href;
    } else {
      helpText += "Error: " + error.message;
    }

    alert(helpText);
  }
}

// Handle scan errors
function onScanError(errorMessage) {
  // Only show real errors, not scanning errors
  if (errorMessage.includes("NotAllowedError")) {
    stopScanning();
    alert(
      '❌ Camera permission denied.\n\nPlease:\n1. Click the 🔒 icon in address bar\n2. Allow camera permission\n3. Try again\n\nOr use "Upload Photo" option below'
    );
  } else if (errorMessage.includes("NotFoundError")) {
    stopScanning();
    alert(
      '❌ No camera found.\n\nPlease use "Upload Barcode Photo" option below'
    );
  } else if (errorMessage.includes("NotReadableError")) {
    stopScanning();
    alert(
      '❌ Camera is being used by another app.\n\nClose other apps and try again\n\nOr use "Upload Photo" option'
    );
  }
}

// Show add product form
function showAddProductForm(barcode) {
  document.getElementById("newBarcode").textContent = barcode;
  document.getElementById("addProductForm").reset();
  document.getElementById("addProductModal").classList.add("active");
}

// Handle add product
async function handleAddProduct(e) {
  e.preventDefault();

  const data = {
    barcode: currentBarcode,
    name: document.getElementById("productName").value,
    category: document.getElementById("productCategory").value,
    cost: parseFloat(document.getElementById("productCost").value),
    stock: parseInt(document.getElementById("productStock").value),
    minStock: parseInt(document.getElementById("productMinStock").value),
  };

  try {
    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      alert("✓ Product added successfully!");
      closeAddModal();
      loadStats();
      loadProducts();
      loadCategories();
    } else {
      const error = await response.json();
      alert("Error: " + error.error);
    }
  } catch (error) {
    alert("Error adding product: " + error.message);
  }
}

// Close add modal
function closeAddModal() {
  document.getElementById("addProductModal").classList.remove("active");
}

// View product details
async function viewProduct(barcode) {
  try {
    const response = await fetch(`${API_URL}/products/barcode/${barcode}`);
    const data = await response.json();

    if (data.exists) {
      showProductDetails(data.product);
    }
  } catch (error) {
    alert("Error loading product: " + error.message);
  }
}

// Show product details
function showProductDetails(product) {
  currentProduct = product;
  currentBarcode = product.barcode;

  const infoHtml = `
                <div class="info-row">
                    <span class="info-label">Barcode</span>
                    <span class="info-value">${product.barcode}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">${product.name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Category</span>
                    <span class="info-value">${product.category}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cost</span>
                    <span class="info-value">₹${product.cost}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Min Stock Alert</span>
                    <span class="info-value">${product.minStock}</span>
                </div>
            `;

  document.getElementById("productInfo").innerHTML = infoHtml;
  document.getElementById("currentStock").textContent = product.stock;
  document.getElementById("viewProductModal").classList.add("active");
}

// Update stock
async function updateStock(action) {
  try {
    const response = await fetch(
      `${API_URL}/products/${currentBarcode}/stock`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, quantity: 1 }),
      }
    );

    const data = await response.json();

    if (data.success) {
      document.getElementById("currentStock").textContent = data.product.stock;
      currentProduct = data.product;
      loadStats();
      loadProducts();
    }
  } catch (error) {
    alert("Error updating stock: " + error.message);
  }
}

// Delete product
async function deleteProduct() {
  const confirmDelete = confirm(
    `⚠️ Are you sure you want to delete "${currentProduct.name}"?\n\nThis action cannot be undone!`
  );

  if (!confirmDelete) return;

  try {
    const response = await fetch(`${API_URL}/products/${currentBarcode}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      alert("✓ Product deleted successfully!");
      closeViewModal();
      loadStats();
      loadProducts();
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    alert("Error deleting product: " + error.message);
  }
}

// Open edit modal
function openEditModal() {
  // Close view modal
  document.getElementById("viewProductModal").classList.remove("active");

  // Populate edit form with current product data
  document.getElementById("editBarcode").textContent = currentProduct.barcode;
  document.getElementById("editProductName").value = currentProduct.name;
  document.getElementById("editProductCategory").value =
    currentProduct.category;
  document.getElementById("editProductCost").value = currentProduct.cost;
  document.getElementById("editProductStock").value = currentProduct.stock;
  document.getElementById("editProductMinStock").value =
    currentProduct.minStock;

  // Open edit modal
  document.getElementById("editProductModal").classList.add("active");
}

// Handle edit product
async function handleEditProduct(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById("editProductName").value,
    category: document.getElementById("editProductCategory").value,
    cost: parseFloat(document.getElementById("editProductCost").value),
    stock: parseInt(document.getElementById("editProductStock").value),
    minStock: parseInt(document.getElementById("editProductMinStock").value),
  };

  try {
    const response = await fetch(`${API_URL}/products/${currentBarcode}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      const result = await response.json();
      alert("✓ Product updated successfully!");
      closeEditModal();

      // Update current product and refresh view
      currentProduct = result.product;
      showProductDetails(currentProduct);
      loadStats();
      loadProducts();
      loadCategories();
    } else {
      const error = await response.json();
      alert("Error: " + error.error);
    }
  } catch (error) {
    alert("Error updating product: " + error.message);
  }
}

// Close edit modal
function closeEditModal() {
  document.getElementById("editProductModal").classList.remove("active");
}

// Close view modal
function closeViewModal() {
  document.getElementById("viewProductModal").classList.remove("active");
}
