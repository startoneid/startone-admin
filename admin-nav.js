// ==============================================================
// ADMIN-NAV.JS
// Mengatur navigasi antar-halaman di dashboard Admin (Dashboard,
// Kelola Produk, Order Masuk, Ulasan Pelanggan) tanpa reload, serta
// toggle sidebar di tampilan mobile. File ini murni untuk tampilan/
// navigasi — semua logika data tetap ada di admin.js.
// ==============================================================

document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.querySelectorAll(".admin-nav-link");
    const pages = document.querySelectorAll(".admin-page");
    const pageTitleEl = document.getElementById("adminPageTitle");
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("adminSidebarOverlay");
    const menuBtn = document.getElementById("adminMenuBtn");

    const PAGE_TITLES = {
        dashboard: "Dashboard & Analitik",
        products: "Kelola Produk",
        orders: "Order Masuk",
        reviews: "Ulasan Pelanggan"
    };

    function openSidebar() {
        sidebar?.classList.add("open");
        overlay?.classList.add("active");
    }

    function closeSidebar() {
        sidebar?.classList.remove("open");
        overlay?.classList.remove("active");
    }

    function goToPage(target) {
        navLinks.forEach((link) => link.classList.toggle("active", link.dataset.page === target));
        pages.forEach((page) => page.classList.toggle("active", page.dataset.page === target));
        if (pageTitleEl) pageTitleEl.textContent = PAGE_TITLES[target] || "Dashboard";
        closeSidebar();
        document.querySelector(".admin-content")?.scrollTo({ top: 0, behavior: "smooth" });
    }

    navLinks.forEach((link) => {
        link.addEventListener("click", () => goToPage(link.dataset.page));
    });

    menuBtn?.addEventListener("click", () => {
        if (sidebar?.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay?.addEventListener("click", closeSidebar);
});
