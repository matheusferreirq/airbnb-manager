// scripts/send-notifications.js
// Executado pelo GitHub Actions todo dia às 10h30 BRT (13h30 UTC)
// Lê reservas do Firestore e envia push via FCM para check-ins do dia

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");
const { getMessaging }        = require("firebase-admin/messaging");

// Credenciais via GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({ credential: cert(serviceAccount) });

const db        = getFirestore();
const messaging = getMessaging();

function todayBRT() {
  // Garante que usa horário de Brasília independente do servidor
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

async function run() {
  const today = todayBRT();
  console.log(`Verificando check-ins para: ${today}`);

  // Busca token do dispositivo
  const tokenDoc = await db.collection("tokens").doc("device").get();
  if (!tokenDoc.exists) {
    console.log("Nenhum token FCM cadastrado. Abra o app e ative as notificações.");
    return;
  }
  const { token } = tokenDoc.data();

  // Busca reservas com check-in hoje e não autorizadas
  const snapshot = await db.collection("reservas")
    .where("checkin", "==", today)
    .where("authorized", "==", false)
    .get();

  if (snapshot.empty) {
    console.log("Nenhum check-in hoje.");
    return;
  }

  for (const docSnap of snapshot.docs) {
    const r = docSnap.data();
    const body = `${r.guestNames} — ${r.flatName}`;
    try {
      await messaging.send({
        token,
        notification: {
          title: "🏠 Check-in hoje!",
          body,
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });
      console.log(`✅ Notificação enviada: ${body}`);
    } catch (err) {
      console.error(`❌ Erro ao enviar para reserva ${docSnap.id}:`, err.message);
    }
  }
}

run().catch(console.error);
