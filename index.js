import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { GoogleGenAI } from '@google/genai';
import pino from 'pino';

// Inisialisasi Google Gemini AI dengan API Key Anda
const ai = new GoogleGenAI({ apiKey: 'AQ.Ab8RN6J9XXYIU_MSMBEiThP6HDXKeva7HY9e5hgir4Q14NQ' });

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot WhatsApp AAQ Store berhasil terhubung!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderNumber = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!messageText) return;

        try {
            const promptSystem = `
            Kamu adalah Customer Service AI yang ramah untuk "AAQ Store", toko online game milik Anugrah Al Qadri.
            Toko ini menyediakan:
            - Garena Undawn Gold (Stok bersih siap kirim, harga mulai Rp 22.000 / 1M, ada diskon grosir).
            - Jasa joki rank, rekber, dan penjualan item MMORPG / akun premium.

            Tugasmu: Jawab pertanyaan pembeli dengan ramah, sopan, informatif, dan gaya bahasa anak gaming/store online Indonesia.
            Pertanyaan pembeli: "${messageText}"
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: promptSystem,
            });

            await sock.sendMessage(senderNumber, { text: response.text }, { quoted: msg });
        } catch (error) {
            console.error('Gagal memproses AI:', error);
            await sock.sendMessage(senderNumber, { text: 'Maaf kak, sistem sedang sibuk sebentar. Silakan chat ulang ya!' }, { quoted: msg });
        }
    });
}

startBot();
