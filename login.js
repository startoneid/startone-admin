// Perbaikan path agar mengambil file dari folder yang sama
import { auth } from "./firebase.js"; 

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("AUTH APP READY");

const email = document.getElementById("email");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const error = document.getElementById("error");

loginBtn.addEventListener("click", async () => {
    error.textContent = "";

    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email.value,
            password.value
        );

        const user = userCredential.user;

        if (user.email !== "startone.id@gmail.com") {
            error.textContent = "Bukan akun admin.";
            return;
        }

        // Perbaikan redirect langsung mengarah ke halaman dashboard admin kamu
        window.location.href = "admin.html"; 

    } catch (err) {
        error.textContent = err.message;
    }
});