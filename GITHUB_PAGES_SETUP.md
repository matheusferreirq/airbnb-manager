# 📱 Setup do GitHub Pages + PWA

## Passos para Configurar o Deploy no GitHub Pages

### 1️⃣ **Verificar Configurações do Repositório GitHub**

Acesse seu repositório no GitHub e vá para **Settings** > **Pages**:

- **Build and deployment**: 
  - Source: `Deploy from a branch`
  - Branch: `main`
  - Folder: `/ (root)`

OU se usar GitHub Actions:

- Source: `GitHub Actions` (automático)

### 2️⃣ **Instalar Dependências**

```bash
npm install
npm install --save-dev sharp  # Para gerar ícones PNG
```

### 3️⃣ **Gerar Ícones PNG**

```bash
npm run generate-icons
```

Isso irá converter o `icon.svg` em:
- `icon-192.png` (192x192)
- `icon-512.png` (512x512)

### 4️⃣ **Build do Projeto**

```bash
npm run build
```

Isso irá gerar a pasta `dist/` pronta para deploy.

### 5️⃣ **Fazer Push para GitHub**

```bash
git add .
git commit -m "chore: prepare for GitHub Pages deployment"
git push origin main
```

### 6️⃣ **Aguardar o Deploy**

O GitHub Actions irá automaticamente:
1. Fazer checkout do código
2. Instalar dependências
3. Gerar ícones
4. Build do projeto
5. Deploy para GitHub Pages

Você pode acompanhar em **Actions** tab no seu repositório.

---

## ✅ Verificar se PWA foi Configurado Corretamente

### No iPhone (iOS):

1. Abra Safari
2. Navegue para: `https://seu-usuario.github.io/airbnb-manager/`
3. Toque em "Compartilhar"
4. Selecione "Adicionar à Tela de Início"
5. Nomeie como "Meus Flats"
6. Confirme

### No Android Chrome:

1. Abra Chrome
2. Navegue para: `https://seu-usuario.github.io/airbnb-manager/`
3. Toque no menu (⋮)
4. Selecione "Instalar app"

---

## 🐛 Solução de Problemas

### ❌ "There isn't a GitHub Pages site here"

**Causa**: GitHub Pages não está configurado ou está apontando para branch errada

**Solução**:
1. Vá para **Settings** > **Pages**
2. Certifique-se que **Build and deployment** > **Source** está configurado
3. Escolha `Deploy from a branch` e selecione `main`
4. Aguarde alguns minutos para o site ficar online

### ❌ PWA não aparece instalável

**Causa**: Manifest.json não está sendo servido corretamente

**Solução**:
1. Verifique se `public/manifest.json` existe
2. Abra DevTools (F12) > **Application** > **Manifest**
3. Verifique se os ícones estão corretos
4. Certifique-se que `start_url` é `/airbnb-manager/`

### ❌ Ícones não aparecem

**Causa**: Ícones PNG não foram gerados

**Solução**:
```bash
npm install --save-dev sharp
npm run generate-icons
npm run build
git push
```

### ❌ "Cannot GET /airbnb-manager/"

**Causa**: Problemas com roteamento do GitHub Pages

**Solução**:
- Crie arquivo `public/_redirects`:
```
/*  /index.html  200
```

Ou configure `vite.config.js` com:
```js
base: '/airbnb-manager/'
```

---

## 📋 Checklist Final

- [ ] Repositório é público
- [ ] GitHub Pages está ativado em **Settings** > **Pages**
- [ ] `vite.config.js` tem `base: '/airbnb-manager/'`
- [ ] `public/manifest.json` existe com `start_url: '/airbnb-manager/'`
- [ ] Ícones PNG foram gerados (`icon-192.png`, `icon-512.png`)
- [ ] `.github/workflows/deploy.yml` existe
- [ ] Build local funciona: `npm run build && npm run preview`
- [ ] Push foi feito para `main` branch
- [ ] GitHub Actions completou com sucesso

---

## 🚀 URLs

- **PWA**: `https://seu-usuario.github.io/airbnb-manager/`
- **Repositório**: `https://github.com/seu-usuario/airbnb-manager`

Substitua `seu-usuario` pelo seu username no GitHub!
