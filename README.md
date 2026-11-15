# Sistema de Gestão de Usina Solar (SolarPlant Manager)

Aplicação web completa para controle e gestão de usinas de energia solar, com autenticação Firebase (Administrador e Usuários Comuns), gerenciamento de clientes, endereços múltiplos, leituras de relógio, cálculo automático de tarifas (R$ 0,75/kWh), taxa da Neoenergia, desconto no Fio B e dashboards analíticos individuais.

Pronto para hospedagem gratuita no **GitHub Pages**.

---

## 🚀 Funcionalidades

1. **Autenticação com Firebase (Email/Senha):**
   - **Perfil Administrador:** Acesso total a todos os módulos, cadastro de usuários, associação de endereços, lançamento de faturas/leituras globais e visão geral do sistema.
   - **Perfil Usuário Comum:** Acesso restrito exclusivamente ao seu próprio painel (dashboard) com seus endereços, consumo por período, valores e economia em relação à Neoenergia.
2. **Cadastro e Gestão de Endereços:**
   - Um usuário pode ter múltiplos endereços de consumo vinculados à sua conta.
3. **Cálculo Automático de Faturamento:**
   - **Tarifa base:** R$ 0,75 por kWh consumido.
   - **Taxa da Neoenergia:** Valor fixo/variável configurável por fatura.
   - **Desconto no Fio B:** Aplicado diretamente sobre o saldo ou tarifa calculada.
4. **Dashboards Interativos:**
   - Gráficos dinâmicos com **Chart.js** exibindo histórico de consumo, evolução de gastos e economia comparativa.

---

## 🛠️ Como Configurar e Rodar no GitHub Pages

### Passo 1: Criar o Projeto no Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Clique em **Add project** (Adicionar projeto) e siga os passos.
3. No painel do projeto, clique no ícone da Web (`</>`) para registrar um aplicativo web.
4. Copie os valores do objeto `firebaseConfig` (apiKey, authDomain, projectId, etc.).
5. No menu lateral esquerdo, vá em **Build > Authentication**, clique em **Get Started** e ative o provedor **Email/Password**.
6. Vá em **Build > Firestore Database**, clique em **Create database**, escolha o modo de teste (ou produção com regras adequadas) e selecione a região mais próxima.

### Passo 2: Configurar as Credenciais no Projeto
Abra o arquivo `js/firebase-config.js` e substitua o objeto `firebaseConfig` pelas suas credenciais reais do Firebase:

```javascript
export const firebaseConfig = {
  apiKey: "SEU_API_KEY_AQUI",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### Passo 3: Criar o Primeiro Usuário Administrador
Como o sistema valida permissões através do Firestore, após criar sua conta de administrador pela tela de cadastro (ou diretamente no Authentication do Firebase), vá no **Firestore Database**, crie uma coleção chamada `users`, use o **UID** do usuário autenticado como ID do documento e adicione o campo:
- `role`: string com o valor `"admin"` (para usuários comuns, use `"client"`).

### Passo 4: Subir para o GitHub e Ativar o GitHub Pages
1. Crie um novo repositório no seu GitHub (ex: `solar-plant-manager`).
2. Faça o upload de todos os arquivos deste pacote para a raiz do repositório.
3. Vá nas **Settings** (Configurações) do repositório no GitHub.
4. No menu lateral, clique em **Pages**.
5. Em **Build and deployment**, na seção **Source**, selecione **Deploy from a branch** e escolha a branch `main` (ou `master`) e a pasta `/ (root)`.
6. Clique em **Save**. Em alguns instantes, o GitHub fornecerá o link público da sua aplicação web!
