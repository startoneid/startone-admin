// 1. Gabungkan import auth dan db dari file firebase.js di folder yang sama
import { auth, db } from "./firebase.js"; 

// 2. Import modul Auth & Firestore dari CDN
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    onSnapshot,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    deleteField,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("ADMIN JS BERJALAN");

// Mencegah stored-XSS: data seperti nama pelanggan berasal langsung dari
// input form checkout di sisi publik, jadi harus di-escape sebelum
// dimasukkan ke innerHTML di panel Admin.
function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

// ==================================================================
// EMAIL OTOMATIS (dipanggil setelah admin verifikasi pesanan)
// Endpoint ini adalah Cloudflare Pages Function (/functions/api/send-email.js)
// yang mengirim email lewat Resend API. Kalau ENV RESEND_API_KEY belum
// diisi di dashboard Cloudflare Pages, fungsi ini akan gagal secara diam-diam
// (tidak mengganggu proses verifikasi order tetap berhasil disimpan).
// Detail setup: lihat PANDUAN-SETUP.md
// ==================================================================
async function sendOrderConfirmationEmail(payload) {
    if (!payload.email) return;

    try {
        const response = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            console.warn("Email konfirmasi belum berhasil terkirim (cek setup email di PANDUAN-SETUP.md):", result);
        } else {
            console.log("Email konfirmasi terkirim ke:", payload.email);
        }
    } catch (error) {
        console.warn("Gagal memanggil layanan email (belum di-setup?):", error.message);
    }
}

// 3. Validasi Login Admin
onAuthStateChanged(auth, (user) => {
    console.log("USER:", user);
    if (!user) {
        console.log("BELUM LOGIN");
        window.location.href = "login.html";
        return;
    }

    console.log("SUDAH LOGIN:", user.email);
    if (user.email !== "startone.id@gmail.com") {
        alert("Akses ditolak.");
        window.location.href = "login.html";
        return;
    }
});

// 4. Inisialisasi DOM Elemen
const tbody = document.getElementById("orders");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const totalOrders = document.getElementById("totalOrders");
const waitingOrders = document.getElementById("waitingOrders");
const verifiedOrders = document.getElementById("verifiedOrders");
const totalRevenue = document.getElementById("totalRevenue");
const reviewsTable = document.getElementById("reviewsTable");
const reviewSearchInput = document.getElementById("reviewSearchInput");

let allOrders = [];

// 5. Realtime Data dari Firestore
onSnapshot(collection(db, "orders"), (snapshot) => {
    let total = 0;
    let waiting = 0;
    let verified = 0;
    let revenue = 0;

    tbody.innerHTML = "";
    allOrders = [];

    snapshot.forEach((documentSnapshot) => {
        const data = documentSnapshot.data();
        allOrders.push({ id: documentSnapshot.id, ...data });

        total++;
        if(data.status === "waiting_verification"){
            waiting++;
        }
        if(data.status === "verified"){
            verified++;
            revenue += Number(data.price);
        }

        totalOrders.textContent = total;
        waitingOrders.textContent = waiting;
        verifiedOrders.textContent = verified;
        totalRevenue.textContent = "Rp " + revenue.toLocaleString("id-ID");

        let action = "";
        if (data.status === "waiting_verification") {
            action = `
                <button onclick="verifyOrder('${documentSnapshot.id}')">✔ Verifikasi</button>
                <button style="background:#dc3545;color:white;margin-left:8px;" onclick="rejectOrder('${documentSnapshot.id}')">✖ Tolak</button>
            `;
        } else {
            action = `<span style="color:#999;">Sudah Diverifikasi</span>`;
        }

        tbody.innerHTML += `
            <tr>
                <td>
                    <span style="font-weight:bold;color:#FFD166;">${data.invoiceNumber || "-"}</span>
                    <br>
                    <button style="margin-top:8px;padding:5px 10px;font-size:12px;cursor:pointer;" onclick="copyInvoice('${data.invoiceNumber}')">Copy</button>
                </td>
                <td>${escapeHTML(data.customerName)}</td>
                <td>${escapeHTML(data.product)}</td>
                <td>Rp ${Number(data.price).toLocaleString("id-ID")}</td>
                <td>
                    ${data.paymentMethod === "ipaymu"
                        ? `<span style="color:#2ecc71;">✅ iPaymu (Otomatis)</span>`
                        : (data.paymentProof ? `<a href="${escapeHTML(data.paymentProof)}" target="_blank">📷 Lihat Bukti</a>` : `<span style="color:red;">Belum Upload</span>`)}
                </td>
                <td>${escapeHTML(data.status)}</td>
                <td>${action}</td>
            </tr>
        `;
    });

    updateAnalyticsCharts();
});

// 6. Global Functions untuk Button Klik (window object)
window.verifyOrder = async (id) => {
    const order = allOrders.find(item => item.id === id);

    // Cari link download dari data produk (field "Link Download Produk" di
    // form Admin). Kalau produk sudah diisi link-nya, admin tidak perlu
    // mengetik ulang setiap kali ada order baru untuk produk yang sama.
    const matchedProduct =
        allProducts.find(p => p.id === order.productId) ||
        allProducts.find(p => p.name === order.product);

    let defaultURL = allProductSecrets[matchedProduct?.id]?.downloadURL || "";

    // Fallback lama untuk order produk lama yang belum sempat diisi field downloadURL-nya
    if (!defaultURL) {
        if (order.product === "Summer Tone") {
            defaultURL = "https://drive.google.com/file/d/1sFhbUASwvK7Qvn75zmkxohk2jDgWJFr7/view?usp=sharing";
        } else if (order.product === "Korean Collection") {
            defaultURL = "downloads/korean-collection.zip";
        } else if (order.product === "Cinematic Collection") {
            defaultURL = "downloads/cinematic-collection.zip";
        }
    }

    // Munculkan dialog box konfirmasi/link download (admin masih bisa mengubahnya manual kalau perlu)
    let downloadURL = prompt(
        `Verifikasi pesanan: ${order.customerName}\n\nMasukkan/konfirmasi link download untuk produk [ ${order.product} ] :`, 
        defaultURL
    );
    
    // Jika admin menekan tombol "Batal" atau "Cancel"
    if (downloadURL === null) return; 

    // Simpan status verifikasi beserta link download-nya ke Firestore database
    try {
        await updateDoc(doc(db, "orders", id), {
            status: "verified",
            downloadReady: true,
            downloadURL: downloadURL.trim()
        });
        alert("Pesanan berhasil diverifikasi!");

        // Kirim email konfirmasi otomatis ke pembeli (butuh Worker Resend
        // sudah dideploy & EMAIL_WORKER_URL diisi — lihat PANDUAN-SETUP.md)
        sendOrderConfirmationEmail({
            email: order.email,
            customerName: order.customerName,
            product: order.product,
            invoiceNumber: order.invoiceNumber,
            downloadURL: downloadURL.trim()
        });

    } catch (error) {
        console.error(error);
        alert("Gagal memverifikasi pesanan.");
    }
};

window.rejectOrder = async (id) => {
    if (!confirm("Yakin ingin menolak pembayaran ini?")) return;
    await updateDoc(doc(db, "orders", id), { status: "rejected" });
};

window.copyInvoice = async (invoice) => {
    try {
        await navigator.clipboard.writeText(invoice);
        alert("Invoice berhasil disalin.");
    } catch(error) {
        console.error(error);
        alert("Gagal menyalin invoice.");
    }
};

// 7. Fitur Filter & Search
function filterOrders() {
    const keyword = searchInput.value.toLowerCase();
    const status = statusFilter.value;
    const rows = tbody.querySelectorAll("tr");

    rows.forEach(row => {
        const customer = row.cells[1].textContent.toLowerCase();
        const product = row.cells[2].textContent.toLowerCase();
        const orderStatus = row.cells[5].textContent.toLowerCase();

        const cocokKeyword = customer.includes(keyword) || product.includes(keyword);
        const cocokStatus = status === "all" || orderStatus === status.toLowerCase();

        row.style.display = (cocokKeyword && cocokStatus) ? "" : "none";
    });
}

searchInput.addEventListener("input", filterOrders);
statusFilter.addEventListener("change", filterOrders);

// ==================================================================
// KELOLA ULASAN PELANGGAN (Reviews)
// Realtime dari koleksi Firestore "reviews". Admin hanya bisa
// menghapus ulasan (moderasi spam/tidak pantas) — sesuai firestore.rules
// yang mengizinkan update/delete koleksi "reviews" hanya untuk admin.
// ==================================================================

let allReviews = [];

function toDateTimeText(timestamp) {
    if (!timestamp || !timestamp.toDate) return "-";
    const d = timestamp.toDate();
    const tanggal = String(d.getDate()).padStart(2, "0") + "/" +
        String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
    const jam = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    return `${tanggal} ${jam}`;
}

function renderReviewsTable() {
    if (!reviewsTable) return;

    const keyword = (reviewSearchInput?.value || "").toLowerCase();

    const filtered = allReviews.filter((review) => {
        const name = (review.name || "").toLowerCase();
        const product = (review.product || "").toLowerCase();
        const message = (review.message || "").toLowerCase();
        return name.includes(keyword) || product.includes(keyword) || message.includes(keyword);
    });

    if (filtered.length === 0) {
        reviewsTable.innerHTML = `
            <tr><td colspan="6" style="text-align:center;color:#999;">
                ${allReviews.length === 0 ? "Belum ada ulasan masuk." : "Tidak ada ulasan yang cocok dengan pencarian."}
            </td></tr>
        `;
        return;
    }

    reviewsTable.innerHTML = filtered.map((review) => `
        <tr>
            <td>${escapeHTML(review.name || "-")}</td>
            <td>${escapeHTML(review.product || "-")}</td>
            <td style="max-width:280px;white-space:pre-wrap;">${escapeHTML(review.message || "-")}</td>
            <td>${"⭐".repeat(Math.min(5, Math.max(0, Number(review.rating) || 0)))}</td>
            <td>${toDateTimeText(review.createdAt)}</td>
            <td>
                <button style="background:#dc3545;color:white;" onclick="deleteReview('${review.id}')">🗑 Hapus</button>
            </td>
        </tr>
    `).join("");
}

onSnapshot(query(collection(db, "reviews"), orderBy("createdAt", "desc")), (snapshot) => {
    allReviews = [];
    snapshot.forEach((docSnap) => {
        allReviews.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderReviewsTable();
}, (error) => {
    console.error("Gagal memuat ulasan:", error);
    if (reviewsTable) {
        reviewsTable.innerHTML = `
            <tr><td colspan="6" style="text-align:center;color:#ff8080;">
                Gagal memuat ulasan.
            </td></tr>
        `;
    }
});

reviewSearchInput?.addEventListener("input", renderReviewsTable);

window.deleteReview = async (id) => {
    if (!confirm("Yakin ingin menghapus ulasan ini? Tindakan ini tidak bisa dibatalkan.")) return;

    try {
        await deleteDoc(doc(db, "reviews", id));
    } catch (error) {
        console.error(error);
        alert("Gagal menghapus ulasan: " + error.message);
    }
};

// 8. Fitur Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            alert("Logout gagal!");
            console.error(error);
        }
    });
}

// ==================================================================
// 9. KELOLA PRODUK (Featured Collections di Halaman Utama)
// ==================================================================
// Setiap perubahan di sini (tambah/edit/hapus) akan otomatis
// tersinkron ke halaman utama karena keduanya membaca koleksi
// Firestore "products" yang sama secara realtime.
// ==================================================================

const productForm = document.getElementById("productForm");
const productFormWrapper = document.getElementById("productFormWrapper");
const toggleProductForm = document.getElementById("toggleProductForm");
const productCancelBtn = document.getElementById("productCancelBtn");
const productsTable = document.getElementById("productsTable");
const productIdInput = document.getElementById("productId");
const productSubmitBtn = document.getElementById("productSubmitBtn");

let allProducts = [];
let allProductSecrets = {}; // { [productId]: { downloadURL } } - hanya bisa dibaca admin (lihat firestore.rules)
let editingProductId = null;

// Realtime data downloadURL produk (koleksi terpisah "productSecrets" supaya
// TIDAK ikut terbaca publik lewat listener "products" di halaman utama/shop).
onSnapshot(collection(db, "productSecrets"), (snapshot) => {
    allProductSecrets = {};
    snapshot.forEach((docSnap) => {
        allProductSecrets[docSnap.id] = docSnap.data();
    });
}, (error) => {
    console.error("Gagal memuat data link download:", error);
});

function resetProductForm() {
    productForm.reset();
    productIdInput.value = "";
    editingProductId = null;
    productSubmitBtn.textContent = "Simpan Produk";
}

// Tombol "+ Tambah Produk" -> buka/tutup form kosong
toggleProductForm?.addEventListener("click", () => {
    const isHidden = productFormWrapper.style.display === "none" || !productFormWrapper.style.display;

    if (isHidden) {
        resetProductForm();
        productFormWrapper.style.display = "block";
    } else {
        productFormWrapper.style.display = "none";
    }
});

// Tombol "Batal" di dalam form
productCancelBtn?.addEventListener("click", () => {
    resetProductForm();
    productFormWrapper.style.display = "none";
});

// Migrasi otomatis satu kali: kalau ada produk LAMA (dibuat sebelum
// pemisahan koleksi productSecrets) yang masih menyimpan downloadURL
// langsung di dokumen "products" (bisa dibaca publik), pindahkan
// diam-diam ke "productSecrets" lalu hapus dari "products". Sehingga
// tidak perlu admin membuka & menyimpan ulang tiap produk satu-satu.
async function migrateLegacyDownloadURL(productId, downloadURL, productName) {
    try {
        await setDoc(doc(db, "productSecrets", productId), { downloadURL }, { merge: true });
        await updateDoc(doc(db, "products", productId), { downloadURL: deleteField() });
        console.log("Migrasi link download lama untuk produk:", productName);
    } catch (error) {
        console.error("Gagal migrasi link download produk", productId, error);
    }
}

// Realtime daftar produk, diurutkan berdasarkan field "order"
onSnapshot(query(collection(db, "products"), orderBy("order", "asc")), (snapshot) => {
    allProducts = [];
    productsTable.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allProducts.push({ id: docSnap.id, ...data });

        // Bersihkan field downloadURL lama kalau masih ada (lihat komentar di atas)
        if (data.downloadURL) {
            migrateLegacyDownloadURL(docSnap.id, data.downloadURL, data.name);
        }

        productsTable.innerHTML += `
            <tr>
                <td>
                    <img src="${data.image || ""}" alt="${data.name || ""}"
                        style="width:70px;height:70px;object-fit:cover;border-radius:8px;">
                </td>
                <td>${data.name || "-"}</td>
                <td>${data.category || "-"}</td>
                <td>Rp ${Number(data.price || 0).toLocaleString("id-ID")}</td>
                <td>${Number(data.itemsSold || 0).toLocaleString("id-ID")}</td>
                <td>
                    <span class="visibility-badge ${data.showInFeatured !== false ? "on" : ""}">Featured</span>
                    <span class="visibility-badge ${data.showInShop !== false ? "on" : ""}">Shop</span>
                </td>
                <td>
                    <button onclick="editProduct('${docSnap.id}')">✎ Edit</button>
                    <button style="background:#dc3545;color:white;margin-left:8px;"
                        onclick="deleteProduct('${docSnap.id}')">🗑 Hapus</button>
                </td>
            </tr>
        `;
    });

    if (allProducts.length === 0) {
        productsTable.innerHTML = `
            <tr><td colspan="7" style="text-align:center;color:#999;">
                Belum ada produk. Klik "+ Tambah Produk" untuk menambahkan.
            </td></tr>
        `;
    }
}, (error) => {
    console.error("Gagal memuat produk:", error);
});

// Submit form -> tambah produk baru ATAU update produk lama
productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Field publik (dibaca semua pengunjung lewat halaman utama & Shop)
    const payload = {
        name: document.getElementById("productName").value.trim(),
        price: Number(document.getElementById("productPrice").value),
        image: document.getElementById("productImage").value.trim(),
        category: document.getElementById("productCategory").value.trim(),
        compatibility: document.getElementById("productCompatibility").value.trim(),
        shortDesc: document.getElementById("productShortDesc").value.trim(),
        detail: document.getElementById("productDetail").value.trim(),
        tips: document.getElementById("productTips").value.trim(),
        itemsSold: Number(document.getElementById("productItemsSold").value) || 0,
        showInFeatured: document.getElementById("productShowInFeatured").checked,
        showInShop: document.getElementById("productShowInShop").checked
    };

    // Link download TIDAK disimpan di sini lagi — field ini sengaja
    // dipisah ke koleksi "productSecrets" yang hanya bisa dibaca oleh
    // Admin (lihat firestore.rules), supaya tidak bisa diakses publik
    // lewat listener produk di halaman utama/Shop sebelum pelanggan bayar.
    const downloadURL = document.getElementById("productDownloadURL").value.trim();

    try {
        let productId = editingProductId;

        if (editingProductId) {
            // Mode edit: perbarui dokumen yang sudah ada
            await updateDoc(doc(db, "products", editingProductId), payload);
        } else {
            // Mode tambah: buat dokumen baru
            // field "order" pakai timestamp supaya produk baru tampil
            // paling akhir/terbaru secara berurutan
            const docRef = await addDoc(collection(db, "products"), {
                ...payload,
                order: Date.now(),
                createdAt: serverTimestamp()
            });
            productId = docRef.id;
        }

        // Simpan/perbarui link download di koleksi terpisah
        await setDoc(doc(db, "productSecrets", productId), { downloadURL }, { merge: true });

        alert(editingProductId ? "Produk berhasil diperbarui!" : "Produk berhasil ditambahkan! Cek halaman utama, jumlah produk sudah bertambah.");

        resetProductForm();
        productFormWrapper.style.display = "none";

    } catch (error) {
        console.error(error);
        alert("Gagal menyimpan produk: " + error.message);
    }
});

// Tombol Edit di tabel
window.editProduct = (id) => {
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;

    editingProductId = id;
    productIdInput.value = id;
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productPrice").value = product.price || "";
    document.getElementById("productImage").value = product.image || "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productCompatibility").value = product.compatibility || "";
    document.getElementById("productShortDesc").value = product.shortDesc || "";
    document.getElementById("productDetail").value = product.detail || "";
    document.getElementById("productTips").value = product.tips || "";
    document.getElementById("productItemsSold").value = product.itemsSold || 0;
    document.getElementById("productDownloadURL").value = allProductSecrets[id]?.downloadURL || "";
    document.getElementById("productShowInFeatured").checked = product.showInFeatured !== false;
    document.getElementById("productShowInShop").checked = product.showInShop !== false;

    productSubmitBtn.textContent = "Update Produk";
    productFormWrapper.style.display = "block";
    productFormWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Tombol Hapus di tabel
window.deleteProduct = async (id) => {
    if (!confirm("Yakin ingin menghapus produk ini? Produk akan langsung hilang dari halaman utama.")) return;

    try {
        await deleteDoc(doc(db, "products", id));
        // Hapus juga link download terkait supaya tidak ada data "yatim" tertinggal
        await deleteDoc(doc(db, "productSecrets", id)).catch(() => {});
        alert("Produk berhasil dihapus.");
    } catch (error) {
        console.error(error);
        alert("Gagal menghapus produk: " + error.message);
    }
};

// ==================================================================
// 10. DASHBOARD ANALITIK (Chart.js)
// ==================================================================
// Grafik dibuat murni dari data "orders" yang sudah ada di allOrders,
// dihitung ulang setiap kali ada perubahan data (realtime).
// ==================================================================

let revenueChartInstance = null;
let topProductsChartInstance = null;

function toDateKey(timestamp) {
    // Firestore Timestamp -> Date -> "DD/MM"
    if (!timestamp || !timestamp.toDate) return null;
    const d = timestamp.toDate();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function updateAnalyticsCharts() {
    const revenueCanvas = document.getElementById("revenueChart");
    const topProductsCanvas = document.getElementById("topProductsChart");
    if (!revenueCanvas || !topProductsCanvas || typeof Chart === "undefined") return;

    // ---- Revenue 30 hari terakhir ----
    const days = [];
    const revenueByDay = {};

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        days.push(key);
        revenueByDay[key] = 0;
    }

    allOrders.forEach(order => {
        if (order.status !== "verified") return;
        const key = toDateKey(order.createdAt);
        if (key && key in revenueByDay) {
            revenueByDay[key] += Number(order.price) || 0;
        }
    });

    const revenueData = days.map(d => revenueByDay[d]);

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(revenueCanvas, {
        type: "line",
        data: {
            labels: days,
            datasets: [{
                label: "Revenue (Rp)",
                data: revenueData,
                borderColor: "#FFD166",
                backgroundColor: "rgba(255,209,102,.15)",
                fill: true,
                tension: 0.35,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#999", maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,.05)" } },
                y: { ticks: { color: "#999" }, grid: { color: "rgba(255,255,255,.05)" } }
            }
        }
    });

    // ---- Produk terlaris (top 5 berdasarkan order verified) ----
    const countByProduct = {};
    allOrders.forEach(order => {
        if (order.status !== "verified") return;
        const name = order.product || "Lainnya";
        countByProduct[name] = (countByProduct[name] || 0) + 1;
    });

    const sorted = Object.entries(countByProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

    if (topProductsChartInstance) topProductsChartInstance.destroy();
    topProductsChartInstance = new Chart(topProductsCanvas, {
        type: "bar",
        data: {
            labels: sorted.map(x => x[0]),
            datasets: [{
                label: "Jumlah Terjual",
                data: sorted.map(x => x[1]),
                backgroundColor: "#FFD166",
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true,
            indexAxis: "y",
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#999", stepSize: 1 }, grid: { color: "rgba(255,255,255,.05)" } },
                y: { ticks: { color: "#ddd" }, grid: { display: false } }
            }
        }
    });
}

// ==================================================================
// 11. EXPORT CSV & BACKUP JSON
// ==================================================================

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function toCSVValue(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function arrayToCSV(rows, headers) {
    const headerLine = headers.map(toCSVValue).join(",");
    const lines = rows.map(row => headers.map(h => toCSVValue(row[h])).join(","));
    return [headerLine, ...lines].join("\n");
}

document.getElementById("exportOrdersBtn")?.addEventListener("click", () => {
    if (allOrders.length === 0) {
        alert("Belum ada data order untuk diekspor.");
        return;
    }

    const headers = ["invoiceNumber", "customerName", "email", "phone", "product", "price", "status"];
    const csv = arrayToCSV(allOrders, headers);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(`startone-orders-${today}.csv`, csv, "text/csv;charset=utf-8;");
});

document.getElementById("exportProductsBtn")?.addEventListener("click", () => {
    if (allProducts.length === 0) {
        alert("Belum ada data produk untuk diekspor.");
        return;
    }

    const headers = ["name", "category", "compatibility", "price", "shortDesc"];
    const csv = arrayToCSV(allProducts, headers);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(`startone-products-${today}.csv`, csv, "text/csv;charset=utf-8;");
});

document.getElementById("backupDataBtn")?.addEventListener("click", () => {
    const backup = {
        exportedAt: new Date().toISOString(),
        products: allProducts,
        productSecrets: allProductSecrets,
        orders: allOrders
    };

    const today = new Date().toISOString().slice(0, 10);
    downloadFile(
        `startone-backup-${today}.json`,
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8;"
    );

    alert("Backup berhasil diunduh. Simpan file ini di tempat yang aman (Google Drive/penyimpanan lokal).");
});