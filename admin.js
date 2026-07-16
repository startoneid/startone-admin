console.log("ADMIN JS BERJALAN");

import { auth } from "../Firebase/firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("ADMIN JS BERJALAN");

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

import { db } from "../Firebase/firebase.js";

import {
    collection,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const tbody = document.getElementById("orders");

const searchInput =
document.getElementById("searchInput");

const statusFilter =
document.getElementById("statusFilter");

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

    snapshot.forEach((document) => {

        const data = document.data();

        allOrders.push({
    id: document.id,
    ...data
});

        total++;

if(data.status==="waiting_verification"){

waiting++;

}

if(data.status==="verified"){

verified++;

revenue += Number(data.price);

}

totalOrders.textContent = total;

waitingOrders.textContent = waiting;

verifiedOrders.textContent = verified;

totalRevenue.textContent =
"Rp " + revenue.toLocaleString("id-ID");

        let action = "";

        if (data.status === "waiting_verification") {

            action = `
    <button onclick="verifyOrder('${document.id}')">
        ✔ Verifikasi
    </button>

    <button
        style="background:#dc3545;color:white;margin-left:8px;"
        onclick="rejectOrder('${document.id}')">
        ✖ Tolak
    </button>
`;

        } else {

            action = `
                <span style="color:#999;">Sudah Diverifikasi</span>
            `;

        }

        tbody.innerHTML += `
            <tr>

               <td>

<span
style="font-weight:bold;color:#FFD166;">
${data.invoiceNumber || "-"}
</span>

<br>

<button
style="
margin-top:8px;
padding:5px 10px;
font-size:12px;
cursor:pointer;
"
onclick="copyInvoice('${data.invoiceNumber}')">

Copy

</button>

</td>

                <td>${data.customerName}</td>

                <td>${data.product}</td>

                <td>Rp ${Number(data.price).toLocaleString("id-ID")}</td>
                

                <td>

${
    data.paymentProof
    ?
    `<a href="${data.paymentProof}" target="_blank">
        📷 Lihat Bukti
    </a>`
    :
    `<span style="color:red;">Belum Upload</span>`
}

</td>

<td>${data.status}</td>

<td>${action}</td>

            </tr>
        `;

    });

});

window.verifyOrder = async (id) => {

    if (!confirm("Yakin ingin memverifikasi pembayaran ini?")) {

        return;

    }

    const order = allOrders.find(item => item.id === id);

let downloadURL = "";

switch (order.product) {

    case "Japan Collection":
        downloadURL = "downloads/japan-collection.zip";
        break;

    case "Korean Collection":
        downloadURL = "downloads/korean-collection.zip";
        break;

    case "Cinematic Collection":
        downloadURL = "downloads/cinematic-collection.zip";
        break;

    default:
        downloadURL = "";
}

await updateDoc(doc(db, "orders", id), {

    status: "verified",

    downloadReady: true,

    downloadURL: downloadURL

});

};

window.rejectOrder = async (id) => {

    await updateDoc(doc(db, "orders", id), {

        status: "rejected"

    });

};

window.copyInvoice = async (invoice)=>{

    try{

        await navigator.clipboard.writeText(invoice);

        alert("Invoice berhasil disalin.");

    }catch(error){

        console.error(error);

        alert("Gagal menyalin invoice.");

    }

};

function filterOrders() {

    const keyword = searchInput.value.toLowerCase();
    const status = statusFilter.value;

    const rows = tbody.querySelectorAll("tr");

    rows.forEach(row => {

        const customer = row.cells[1].textContent.toLowerCase();
        const product = row.cells[2].textContent.toLowerCase();
        const orderStatus = row.cells[5].textContent.toLowerCase();

        const cocokKeyword =
            customer.includes(keyword) ||
            product.includes(keyword);

        const cocokStatus =
            status === "all" ||
            orderStatus === status.toLowerCase();

        if (cocokKeyword && cocokStatus) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }

    });

}

searchInput.addEventListener("input", filterOrders);

statusFilter.addEventListener("change", filterOrders);

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

