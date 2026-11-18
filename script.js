
import { createClient } from
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =================================
   KONFIGURASI SUPABASE
================================= */

const SUPABASE_URL = "https://zgcahihizevozbogtacy.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_Vw3X5lcq-Xot5-bBgt9NnQ_iuF1hOEX";

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

/* =================================
   DATA LAYANAN
================================= */

const layananList = {
    R1: "BAST - Notaris Ibu Maria Magdalena",
    R2: "BAST - Notaris Ibu Telly Feberianawati",
    R3: "BAST - Notaris Ibu Tiara Vita",
    R4: "BAST - Notaris Bpk Achmad Muharam",
    PBB: "Pengambilan PBB",
    LGL: "Pengambilan Dokumen Asli",
    PPJB: "Pengambilan PPJB"
};

/* =================================
   VARIABEL GLOBAL
================================= */

let antrean = [];
let aktif = null;

let halamanSekarang = 1;
const dataPerHalaman = 10;

let suaraMonitorAktif = false;
let waktuPanggilanTerakhir = null;

let sedangMemuat = false;

let channelMonitor = null;
let channelOperator = null;

let authListener = null;

/* =================================
   FUNGSI UMUM
================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatNomor(layanan, nomor) {
    return layanan + "-" +
        String(nomor || 0).padStart(3, "0");
}

function tampilkanError(pesan, error) {
    console.error(pesan, error);

    alert(
        pesan +
        (error?.message ? "\n\n" + error.message : "")
    );
}

/* =================================
   TAMPILKAN NOMOR AKTIF
================================= */

function tampilkanDataAktif(data) {
    const nomor = document.getElementById("nomorAktif");
    const nama = document.getElementById("namaAktif");
    const layanan = document.getElementById("layananAktif");

    if (nomor) {
        nomor.textContent =
            data?.nomor_antrean || "-";
    }

    if (nama) {
        nama.textContent =
            data?.nama || "Belum ada antrean";
    }

    if (layanan) {
        layanan.textContent = data
            ? layananList[data.kode_layanan] || data.kode_layanan
            : "Silakan menunggu panggilan";
    }
}

/* =================================
   TAMPILKAN COUNTER LAYANAN
================================= */

function tampilkanCounter(data) {
    const mapping = {
        R1: "jumlahR1",
        R2: "jumlahR2",
        R3: "jumlahR3",
        R4: "jumlahR4",
        PBB: "jumlahPBB",
        LGL: "jumlahLGL",
        PPJB: "jumlahPPJB"
    };

    Object.keys(mapping).forEach(kode => {
        const elemen = document.getElementById(mapping[kode]);

        if (!elemen) return;

        const item = data?.find(
            row => row.kode_layanan === kode
        );

        elemen.textContent = formatNomor(
            kode,
            item?.nomor_terakhir || 0
        );
    });
}

/* =================================
   PELANGGAN: AMBIL NOMOR ANTREAN
================================= */

window.ambilAntrean = async function () {
    const namaInput = document.getElementById("nama");
    const layananInput = document.getElementById("layanan");
    const hasil = document.getElementById("hasil");
    const tombol = document.getElementById("btnAmbil");

    if (!namaInput || !layananInput || !hasil) {
        console.error("Formulir pengambilan antrean tidak ditemukan.");
        return;
    }

    const nama = namaInput.value.trim();
    const layanan = layananInput.value;

    if (!nama || !layanan) {
        alert("Nama dan jenis layanan harus diisi!");
        return;
    }

    if (!layananList[layanan]) {
        alert("Jenis layanan tidak valid!");
        return;
    }

    if (sedangMemuat) return;

    sedangMemuat = true;

    if (tombol) tombol.disabled = true;

    try {
        const { data, error } = await supabase.rpc(
            "buat_antrean",
            {
                p_nama: nama,
                p_layanan: layanan
            }
        );

        if (error) throw error;

        hasil.innerHTML = `
            <div class="hasil-antrean">
                Nomor antrean Anda:
                <h2>${escapeHTML(data)}</h2>
                <p>
                    Layanan:
                    ${escapeHTML(layananList[layanan])}
                </p>
            </div>
        `;

        namaInput.value = "";
        layananInput.value = "";

    } catch (error) {
        tampilkanError(
            "Gagal mengambil nomor antrean.",
            error
        );

    } finally {
        sedangMemuat = false;

        if (tombol) tombol.disabled = false;
    }
};

/* =================================
   MONITOR: MUAT DATA DARI SUPABASE
================================= */

async function muatMonitor() {
    const { data: display, error: displayError } =
        await supabase
            .from("display_antrean")
            .select("*")
            .eq("id", 1)
            .maybeSingle();

    if (displayError) {
        console.error(
            "Gagal memuat antrean aktif:",
            displayError
        );
    } else {
        tampilkanDataAktif(display);

        waktuPanggilanTerakhir =
            display?.updated_at || null;
    }

    const { data: counters, error: counterError } =
        await supabase
            .from("display_counter")
            .select("*");

    if (counterError) {
        console.error(
            "Gagal memuat jumlah antrean:",
            counterError
        );
    } else {
        tampilkanCounter(counters);
    }
}

/* =================================
   SUARA PEMANGGILAN ANTREAN
================================= */

function suaraAntrean(data) {
    if (!data || !("speechSynthesis" in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const namaLayanan =
        layananList[data.kode_layanan] ||
        data.kode_layanan;

    const pesan = new SpeechSynthesisUtterance(
        "Nomor antrean " +
        data.nomor_antrean +
        ", atas nama " +
        data.nama +
        ", untuk layanan " +
        namaLayanan +
        ", silakan menuju petugas."
    );

    pesan.lang = "id-ID";
    pesan.rate = 0.9;
    pesan.pitch = 1;

    window.speechSynthesis.speak(pesan);
}

/* =================================
   AKTIFKAN SUARA MONITOR
================================= */

window.aktifkanSuara = function () {
    suaraMonitorAktif = true;

    const status =
        document.getElementById("statusSuara");

    const tombol =
        document.getElementById("btnSuara");

    if (status) {
        status.textContent =
            "Suara monitor telah diaktifkan.";
    }

    if (tombol) {
        tombol.innerHTML =
            '<i class="bi bi-volume-up-fill"></i> Suara Aktif';
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const pesan = new SpeechSynthesisUtterance(
            "Suara monitor antrean telah aktif."
        );

        pesan.lang = "id-ID";

        window.speechSynthesis.speak(pesan);
    }
};

/* =================================
   MONITOR: REALTIME
================================= */

function pasangRealtimeMonitor() {
    if (channelMonitor) return;

    channelMonitor = supabase
        .channel("monitor-antrean")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "display_antrean"
            },
            payload => {
                const data =
                    payload.eventType === "DELETE"
                        ? null
                        : payload.new;

                tampilkanDataAktif(data);

                if (
                    suaraMonitorAktif &&
                    data?.updated_at &&
                    data.updated_at !== waktuPanggilanTerakhir &&
                    data.nomor_antrean
                ) {
                    suaraAntrean(data);
                }

                waktuPanggilanTerakhir =
                    data?.updated_at || null;
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "display_counter"
            },
            () => {
                muatMonitor();
            }
        )

        .subscribe(status => {
            console.log(
                "Realtime monitor:",
                status
            );
        });
}

/* =================================
   OPERATOR: LOGIN
================================= */

window.loginOperator = async function () {
    const email = document
        .getElementById("emailOperator")
        ?.value.trim();

    const password = document
        .getElementById("passwordOperator")
        ?.value;

    const errorBox =
        document.getElementById("loginError");

    const tombol =
        document.getElementById("btnLogin");

    if (!email || !password) {
        if (errorBox) {
            errorBox.textContent =
                "Email dan password harus diisi.";
        }

        return;
    }

    if (tombol) tombol.disabled = true;

    if (errorBox) errorBox.textContent = "";

    try {
        const { error } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        await tampilkanDashboardOperator();

    } catch (error) {
        console.error("Login operator gagal:", error);

        if (errorBox) {
            errorBox.textContent =
                "Login gagal: " + error.message;
        }

    } finally {
        if (tombol) tombol.disabled = false;
    }
};

/* =================================
   OPERATOR: LOGOUT
================================= */

window.logoutOperator = async function () {
    const { error } =
        await supabase.auth.signOut();

    if (error) {
        tampilkanError(
            "Gagal keluar dari akun.",
            error
        );

        return;
    }

    if (channelOperator) {
        await supabase.removeChannel(channelOperator);
        channelOperator = null;
    }

    const dashboard =
        document.getElementById("dashboardPanel");

    const login =
        document.getElementById("loginPanel");

    if (dashboard) dashboard.hidden = true;
    if (login) login.hidden = false;

    antrean = [];
    aktif = null;

    const errorBox =
        document.getElementById("loginError");

    if (errorBox) errorBox.textContent = "";
};

/* =================================
   OPERATOR: TAMPILKAN DASHBOARD
================================= */

async function tampilkanDashboardOperator() {
    const { data, error } =
        await supabase.auth.getSession();

    if (error) {
        console.error(
            "Gagal memeriksa sesi login:",
            error
        );

        return;
    }

    const sudahLogin = !!data.session;

    const loginPanel =
        document.getElementById("loginPanel");

    const dashboard =
        document.getElementById("dashboardPanel");

    if (loginPanel) {
        loginPanel.hidden = sudahLogin;
    }

    if (dashboard) {
        dashboard.hidden = !sudahLogin;
    }

    if (sudahLogin) {
        await muatAntreanOperator();
        pasangRealtimeOperator();
    }
}

/* =================================
   OPERATOR: MUAT DATA ANTREAN
================================= */

async function muatAntreanOperator() {
    const { data, error } = await supabase
        .from("antrean")
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {
        tampilkanError(
            "Gagal mengambil data antrean.",
            error
        );

        return;
    }

    antrean = data || [];

    aktif = antrean.find(
        item => item.status === "Dipanggil"
    ) || null;

    tampilkanAntreanOperator();
}

/* =================================
   OPERATOR: TAMPILKAN TABEL
================================= */

function tampilkanAntreanOperator() {
    const tabel =
        document.getElementById("daftarAntrean");

    if (!tabel) return;

    const daftar = [...antrean].sort(
        (a, b) =>
            new Date(a.created_at) -
            new Date(b.created_at)
    );

    const totalHalaman = Math.max(
        1,
        Math.ceil(daftar.length / dataPerHalaman)
    );

    halamanSekarang = Math.max(
        1,
        Math.min(halamanSekarang, totalHalaman)
    );

    const awal =
        (halamanSekarang - 1) * dataPerHalaman;

    const dataHalaman = daftar.slice(
        awal,
        awal + dataPerHalaman
    );

    tabel.innerHTML = "";

    if (dataHalaman.length === 0) {
        tabel.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center">
                    Belum ada antrean.
                </td>
            </tr>
        `;
    } else {
        dataHalaman.forEach((a, index) => {
            let tombol = "-";

            if (a.status !== "Selesai") {
                const label =
                    a.status === "Menunggu"
                        ? "Panggil"
                        : "Panggil Ulang";

                tombol = `
                    <button
                        class="btn-warning btn-repeat"
                        onclick="panggilUlang('${escapeHTML(a.nomor_antrean)}')"
                        type="button"
                    >
                        <i class="bi bi-volume-up-fill"></i>
                        ${label}
                    </button>
                `;
            }

            tabel.innerHTML += `
                <tr>
                    <td>${awal + index + 1}</td>

                    <td>
                        <strong>
                            ${escapeHTML(a.nomor_antrean)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(a.nama)}
                    </td>

                    <td>
                        ${escapeHTML(
                            layananList[a.kode_layanan] ||
                            a.kode_layanan
                        )}
                    </td>

                    <td>
                        <span class="status-${String(a.status).toLowerCase()}">
                            ${escapeHTML(a.status)}
                        </span>
                    </td>

                    <td>${tombol}</td>
                </tr>
            `;
        });
    }

    const info =
        document.getElementById("infoHalaman");

    const sebelumnya =
        document.getElementById("btnSebelumnya");

    const berikutnya =
        document.getElementById("btnBerikutnya");

    if (info) {
        info.textContent =
            `Halaman ${halamanSekarang} dari ${totalHalaman}`;
    }

    if (sebelumnya) {
        sebelumnya.disabled =
            halamanSekarang === 1;
    }

    if (berikutnya) {
        berikutnya.disabled =
            halamanSekarang === totalHalaman;
    }
}

/* =================================
   OPERATOR: PAGINATION
================================= */

window.ubahHalaman = function (arah) {
    halamanSekarang += arah;

    tampilkanAntreanOperator();
};

/* =================================
   OPERATOR: REALTIME
================================= */

function pasangRealtimeOperator() {
    if (channelOperator) return;

    channelOperator = supabase
        .channel("operator-antrean")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "antrean"
            },
            () => {
                muatAntreanOperator();
            }
        )

        .subscribe(status => {
            console.log(
                "Realtime operator:",
                status
            );
        });
}

/* =================================
   OPERATOR: PANGGIL BERIKUTNYA
================================= */

window.panggilBerikutnya = async function () {
    const { data, error } =
        await supabase.rpc("panggil_berikutnya");

    if (error) {
        tampilkanError(
            "Gagal memanggil antrean berikutnya.",
            error
        );

        return;
    }

    if (!data) {
        alert(
            "Tidak ada antrean lain yang menunggu."
        );
    }

    await muatAntreanOperator();
    await muatMonitor();
};

/* =================================
   OPERATOR: PANGGIL ULANG / PANGGIL LANGSUNG
================================= */

window.panggilUlang = async function (nomor = null) {
    if (!nomor) {
        if (!aktif) {
            alert("Tidak ada antrean aktif.");
            return;
        }

        nomor = aktif.nomor_antrean;
    }

    const { data, error } = await supabase.rpc(
        "panggil_antrean",
        {
            p_nomor: nomor
        }
    );

    if (error) {
        tampilkanError(
            "Gagal memanggil antrean.",
            error
        );

        return;
    }

    if (!data) {
        alert(
            "Antrean tidak ditemukan atau sudah selesai."
        );

        return;
    }

    await muatAntreanOperator();
    await muatMonitor();
};

/* =================================
   OPERATOR: SELESAIKAN ANTREAN
================================= */

window.selesaikanAntrean = async function () {
    if (!aktif) {
        alert("Tidak ada antrean aktif.");
        return;
    }

    const { error } =
        await supabase.rpc("selesaikan_antrean");

    if (error) {
        tampilkanError(
            "Gagal menyelesaikan antrean.",
            error
        );

        return;
    }

    await muatAntreanOperator();
    await muatMonitor();
};

/* =================================
   OPERATOR: LEWATI ANTREAN
================================= */

window.lewatiAntrean = async function () {
    if (!aktif) {
        alert("Tidak ada antrean aktif.");
        return;
    }

    const { error } =
        await supabase.rpc("lewati_antrean");

    if (error) {
        tampilkanError(
            "Gagal melewati antrean.",
            error
        );

        return;
    }

    await muatAntreanOperator();
    await muatMonitor();
};

/* =================================
   OPERATOR: RESET ANTREAN
================================= */

window.resetAntrean = async function () {
    const konfirmasi = confirm(
        "Apakah Anda yakin ingin mereset semua antrean?\n\n" +
        "Seluruh data antrean dan nomor layanan akan dihapus."
    );

    if (!konfirmasi) return;

    const { error } =
        await supabase.rpc("reset_antrean");

    if (error) {
        tampilkanError(
            "Gagal mereset antrean.",
            error
        );

        return;
    }

    halamanSekarang = 1;
    aktif = null;
    antrean = [];

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    await muatAntreanOperator();
    await muatMonitor();

    alert("Semua antrean berhasil direset.");
};

/* =================================
   INISIALISASI APLIKASI
================================= */

async function mulaiAplikasi() {
    console.log("Sistem antrean sedang dimulai...");

    const halamanPelanggan =
        document.getElementById("btnAmbil");

    const halamanMonitor =
        document.getElementById("btnSuara");

    const halamanOperator =
        document.getElementById("loginPanel");

    try {

        /*
         * MONITOR
         * Berjalan pada customer.html
         * dan index.html.
         */

        if (halamanMonitor) {
            console.log("Monitor antrean aktif.");

            await muatMonitor();
            pasangRealtimeMonitor();
        }

        /*
         * FORM PELANGGAN
         * Hanya tersedia di index.html.
         */

        if (halamanPelanggan) {
            console.log("Form pelanggan aktif.");
        }

        /*
         * DASHBOARD PETUGAS
         * Hanya tersedia di index.html.
         */

        if (halamanOperator) {
            console.log("Dashboard petugas aktif.");

            await tampilkanDashboardOperator();

            /*
             * Pantau perubahan status login.
             */

            if (!authListener) {
                authListener =
                    supabase.auth.onAuthStateChange(
                        (event, session) => {
                            console.log(
                                "Status autentikasi:",
                                event
                            );

                            if (event === "SIGNED_OUT") {
                                const dashboard =
                                    document.getElementById("dashboardPanel");

                                const login =
                                    document.getElementById("loginPanel");

                                if (dashboard) {
                                    dashboard.hidden = true;
                                }

                                if (login) {
                                    login.hidden = false;
                                }

                                antrean = [];
                                aktif = null;

                                if (channelOperator) {
                                    supabase.removeChannel(
                                        channelOperator
                                    );

                                    channelOperator = null;
                                }
                            }

                            if (event === "SIGNED_IN") {
                                tampilkanDashboardOperator();
                            }
                        }
                    );
            }
        }

        if (
            !halamanPelanggan &&
            !halamanMonitor &&
            !halamanOperator
        ) {
            console.warn(
                "Halaman tidak dikenali. Periksa ID elemen HTML."
            );
        }

        console.log("Inisialisasi aplikasi selesai.");

    } catch (error) {
        console.error(
            "Gagal menjalankan aplikasi:",
            error
        );
    }
}

/* =================================
   JALANKAN APLIKASI
================================= */

mulaiAplikasi();
