import { auth, db } from "./firebase.js"; 

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
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log("ADMIN JS BERJALAN");

// 1. Validasi Login Admin
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    if (user.email !== "startone.id@gmail.com") {
        alert("Akses ditolak.");
        window.location.href = "login.html";
        return;
    }
});

// ==========================================
// 🚀 FITUR A: TAMBAH PRODUK BARU KE FIRESTORE
// ==========================================
const addProductForm = document.getElementById("addProductForm");
if (addProductForm) {
    addProductForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("newProdName").value.trim();
        const price = Number(document.getElementById("newProdPrice").value);
        const imageUrl = document.getElementById("newProdImage").value.trim();
        const driveUrl = document.getElementById("newProdDrive").value.trim();
        const desc = document.getElementById("newProdDesc").value.trim();

        try {
            // Menyimpan ke koleksi "products" di Firestore
            await addDoc(collection(db, "products"), {
                name: name,
                price: price,
                image: imageUrl,
                downloadURL: driveUrl,
                description: desc
            });

            alert("Produk baru berhasil ditambahkan dan terbit secara Realtime!");
            addProductForm.reset();
        } catch (error) {
            console.error("Error menambahkan produk:", error);
            alert("Gagal menambahkan produk: " + error.message);
        }
    });
}

// ==========================================
// 📦 FITUR B: TAMPILKAN & HAPUS DAFTAR PRODUK AKTIF
// ==========================================
const activeProductsList = document.getElementById("activeProductsList");

onSnapshot(collection(db, "products"), (snapshot) => {
    if (!activeProductsList) return;
    
    activeProductsList.innerHTML = "";
    
    if (snapshot.empty) {
        activeProductsList.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#aaa;">Belum ada produk jualan. Silakan tambah di atas!</td></tr>`;
        return;
    }

    snapshot.forEach((documentSnapshot) => {
        const product = documentSnapshot.data();
        const prodId = documentSnapshot.id;

        activeProductsList.innerHTML += `
            <tr>
                <td><img src="${product.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;"></td>
                <td style="font-weight: bold; color: white;">${product.name}</td>
                <td style="color: #FFD166;">Rp ${Number(product.price).toLocaleString("id-ID")}</td>
                <td>
                    <button style="background: #dc3545; color: white; padding: 6px 12px; font-size: 12px;" onclick="deleteProduct('${prodId}')">🗑 Hapus</button>
                </td>
            </tr>
        `;
    });
});

// Fungsi Global untuk menghapus produk dari database
window.deleteProduct = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus produk jualan ini dari toko?")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        alert("Produk berhasil dihapus!");
    } catch (error) {
        console.error("Gagal menghapus produk:", error);
        alert("Gagal menghapus produk.");
    }
};

// ==========================================
// 📝 FITUR C: KELOLA ORDERAN MASUK & VERIFIKASI OTOMATIS
// ==========================================
const tbody = document.getElementById("orders");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const totalOrders = document.getElementById("totalOrders");
const waitingOrders = document.getElementById("waitingOrders");
const verifiedOrders = document.getElementById("verifiedOrders");
const totalRevenue = document.getElementById("totalRevenue");

let allOrders = [];

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

// Verifikasi Order Otomatis mengambil link dari database produk
window.verifyOrder = async (id) => {
    const order = allOrders.find(item => item.id === id);
    
    let downloadURL = "";

    try {
        // 1. Cari data produk pembeli di database "products" secara otomatis
        const q = query(collection(db, "products"), where("name", "==", order.product));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Jika ditemukan produk yang cocok, ambil link downloadnya secara otomatis!
            const prodData = querySnapshot.docs[0].data();
            downloadURL = prodData.downloadURL;
        } else {
            // Fallback cadangan untuk produk lama kamu yang tidak ada di database baru
            if (order.product === "Summer Tone") downloadURL = "downloads/japan-collection.zip";
            else if (order.product === "Korean Collection") downloadURL = "downloads/korean-collection.zip";
            else if (order.product === "Cinematic Collection") downloadURL = "downloads/cinematic-collection.zip";
        }

        // 2. Munculkan prompt untuk mengonfirmasi atau memodifikasi link tersebut
        let finalLink = prompt(
            `Verifikasi pesanan ${order.customerName}.\nPastikan link Google Drive download ini sudah benar:`, 
            downloadURL
        );

        if (finalLink === null) return; // Jika klik batal

        await updateDoc(doc(db, "orders", id), {
            status: "verified",
            downloadReady: true,
            downloadURL: finalLink.trim()
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

// Fitur Filter & Search
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

if(searchInput) searchInput.addEventListener("input", filterOrders);
if(statusFilter) statusFilter.addEventListener("change", filterOrders);

// Fitur Logout
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