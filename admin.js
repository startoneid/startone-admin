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
    updateDoc,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("ADMIN JS BERJALAN");

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
                <td>${data.customerName}</td>
                <td>${data.product}</td>
                <td>Rp ${Number(data.price).toLocaleString("id-ID")}</td>
                <td>
                    ${data.paymentProof ? `<a href="${data.paymentProof}" target="_blank">📷 Lihat Bukti</a>` : `<span style="color:red;">Belum Upload</span>`}
                </td>
                <td>${data.status}</td>
                <td>${action}</td>
            </tr>
        `;
    });
});

// 6. Global Functions untuk Button Klik (window object)
window.verifyOrder = async (id) => {
    const order = allOrders.find(item => item.id === id);
    
    // Tentukan saran link default berdasarkan produk lama kamu agar tidak repot mengetik ulang
    let defaultURL = "";
    if (order.product === "Summer Tone") {
        defaultURL = "https://drive.google.com/file/d/1sFhbUASwvK7Qvn75zmkxohk2jDgWJFr7/view?usp=sharing";
    } else if (order.product === "Korean Collection") {
        defaultURL = "downloads/korean-collection.zip";
    } else if (order.product === "Cinematic Collection") {
        defaultURL = "downloads/cinematic-collection.zip";
    }

    // Munculkan dialog box prompt pengisian link download (Bisa kamu paste link GDrive produk baru di sini)
    let downloadURL = prompt(
        `Verifikasi pesanan: ${order.customerName}\n\nMasukkan link download untuk produk [ ${order.product} ] :`, 
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
let editingProductId = null;

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

// Realtime daftar produk, diurutkan berdasarkan field "order"
onSnapshot(query(collection(db, "products"), orderBy("order", "asc")), (snapshot) => {
    allProducts = [];
    productsTable.innerHTML = "";

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allProducts.push({ id: docSnap.id, ...data });

        productsTable.innerHTML += `
            <tr>
                <td>
                    <img src="${data.image || ""}" alt="${data.name || ""}"
                        style="width:70px;height:70px;object-fit:cover;border-radius:8px;">
                </td>
                <td>${data.name || "-"}</td>
                <td>Rp ${Number(data.price || 0).toLocaleString("id-ID")}</td>
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
            <tr><td colspan="4" style="text-align:center;color:#999;">
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

    const payload = {
        name: document.getElementById("productName").value.trim(),
        price: Number(document.getElementById("productPrice").value),
        image: document.getElementById("productImage").value.trim(),
        shortDesc: document.getElementById("productShortDesc").value.trim(),
        detail: document.getElementById("productDetail").value.trim(),
        tips: document.getElementById("productTips").value.trim()
    };

    try {
        if (editingProductId) {
            // Mode edit: perbarui dokumen yang sudah ada
            await updateDoc(doc(db, "products", editingProductId), payload);
            alert("Produk berhasil diperbarui!");
        } else {
            // Mode tambah: buat dokumen baru
            // field "order" pakai timestamp supaya produk baru tampil
            // paling akhir/terbaru secara berurutan
            await addDoc(collection(db, "products"), {
                ...payload,
                order: Date.now(),
                createdAt: serverTimestamp()
            });
            alert("Produk berhasil ditambahkan! Cek halaman utama, jumlah produk sudah bertambah.");
        }

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
    document.getElementById("productShortDesc").value = product.shortDesc || "";
    document.getElementById("productDetail").value = product.detail || "";
    document.getElementById("productTips").value = product.tips || "";

    productSubmitBtn.textContent = "Update Produk";
    productFormWrapper.style.display = "block";
    productFormWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
};

// Tombol Hapus di tabel
window.deleteProduct = async (id) => {
    if (!confirm("Yakin ingin menghapus produk ini? Produk akan langsung hilang dari halaman utama.")) return;

    try {
        await deleteDoc(doc(db, "products", id));
        alert("Produk berhasil dihapus.");
    } catch (error) {
        console.error(error);
        alert("Gagal menghapus produk: " + error.message);
    }
};