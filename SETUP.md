# 🏠 Meus Flats — Guia de Setup

## O que você vai precisar
- Conta no GitHub (gratuito)
- Conta no Firebase (gratuito)
- Node.js instalado no computador
- iPhone com iOS 16.4+ e Safari

---

## PASSO 1 — Criar projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em **"Criar um projeto"** → dê um nome (ex: `meus-flats`)
3. Desative o Google Analytics (não precisa) → **Criar projeto**

### 1a. Ativar Firestore
- No menu lateral: **Firestore Database** → **Criar banco de dados**
- Escolha **"Iniciar no modo de produção"**
- Selecione a região `southamerica-east1` (São Paulo)

**Regras de segurança** — substitua as regras por:
```
rules_version = '2';
service cloud.firestore.beta1 {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
> ⚠️ Isso deixa o banco aberto. Para um app pessoal tudo bem, mas se quiser restringir depois é só configurar autenticação.

### 1b. Ativar Cloud Messaging (FCM)
- No menu lateral: **Project Settings** (ícone de engrenagem) → aba **Cloud Messaging**
- Em **"Web Push certificates"**, clique em **"Generate key pair"**
- Copie a **VAPID Key** gerada

### 1c. Pegar as credenciais do app web
- **Project Settings** → aba **General** → rolar até "Your apps"
- Clique em **"Add app"** → ícone Web (`</>`)
- Registre o app (nickname: `meus-flats-web`)
- Copie o objeto `firebaseConfig` exibido

---

## PASSO 2 — Preencher as credenciais no código

### Abra `src/firebase.js` e substitua:
```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",     // ← cole aqui
  authDomain:        "meus-flats.firebaseapp.com",
  projectId:         "meus-flats",
  storageBucket:     "meus-flats.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc",
};

export const VAPID_KEY = "BK...";    // ← cole a VAPID key aqui
```

### Abra `public/firebase-messaging-sw.js` e cole as **mesmas credenciais**

---

## PASSO 3 — Criar o repositório no GitHub

```bash
# No terminal, dentro da pasta airbnb-pwa:
git init
git add .
git commit -m "feat: primeiro commit"
git branch -M main

# Crie um repositório chamado "airbnb" no GitHub.com, depois:
git remote add origin https://github.com/SEU_USUARIO/airbnb.git
git push -u origin main
```

### Ativar GitHub Pages
1. No repositório → **Settings** → **Pages**
2. Em **Source**: selecione **"GitHub Actions"**

O primeiro deploy roda automaticamente. Em ~2 minutos o app estará em:
`https://SEU_USUARIO.github.io/airbnb/`

---

## PASSO 4 — Configurar a secret do Firebase (para notificações)

1. No Firebase Console → **Project Settings** → aba **Service accounts**
2. Clique em **"Generate new private key"** → baixa um arquivo JSON
3. No GitHub → **Settings** → **Secrets and variables** → **Actions**
4. Clique em **"New repository secret"**:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** cole todo o conteúdo do arquivo JSON baixado
5. Salvar

---

## PASSO 5 — Instalar no iPhone

1. Abra o link `https://SEU_USUARIO.github.io/airbnb/` no **Safari**
2. Toque no botão de compartilhar (quadrado com seta)
3. **"Adicionar à Tela de Início"** → **Adicionar**
4. Abra o app pelo ícone criado
5. Vá em **⚙️ Config** → **"Ativar notificações"** → aceite a permissão

---

## PASSO 6 — Testar as notificações

Para testar sem esperar até 10h30:
1. No GitHub → aba **Actions** → **"Enviar notificações de check-in"**
2. Clique em **"Run workflow"**
3. Se tiver alguma reserva com check-in hoje, chegará a notificação

---

## Observações importantes

- O app funciona **offline** depois da primeira abertura (PWA cache)
- Os dados ficam no **localStorage** do Safari + **Firestore** (para notificações)
- Se trocar de iPhone, abra o app no novo, vá em Config e reimporte o backup
- O cron do GitHub Actions pode ter atraso de até 10 minutos

---

## Atualizar o app

Sempre que fizer mudanças e rodar `git push`, o GitHub Actions faz o deploy automaticamente.
