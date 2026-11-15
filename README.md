# ACGO Energia Solar - Sistema de Gestão de Usina Solar

Aplicação web completa para controle e gestão de usinas de energia solar, integrada ao **Firebase** (Administrador e Usuários Comuns), gerenciamento de múltiplos endereços por cliente, leituras de relógio, cálculo automático de tarifas (R$ 0,75/kWh), taxa da Neoenergia, desconto no Fio B, dashboards analíticos e a identidade visual oficial da **ACGO Energia Solar**.

Pronto para hospedagem gratuita no **GitHub Pages**.

---

## 🚀 Funcionalidades

1. **Autenticação com Firebase (Email/Senha):**
   - **Perfil Administrador:** Acesso total a todos os módulos, cadastro de usuários, associação de endereços, lançamento de faturas/leituras globais e visão geral do sistema.
   - **Perfil Usuário Comum:** Acesso restrito exclusivamente ao seu próprio painel (dashboard) com seus endereços, consumo por período, valores e economia em relação à Neoenergia.
2. **Identidade Visual Oficial (ACGO Energia Solar):**
   - Logo oficial integrada nos painéis de login e cabeçalhos.
   - Paleta de cores inspirada na logo (Azul Céu, Verde Campo e Amarelo Solar).
3. **Cálculo Automático de Faturamento:**
   - **Tarifa base:** R$ 0,75 por kWh consumido.
   - **Taxa da Neoenergia:** Valor configurável por fatura.
   - **Desconto no Fio B:** Aplicado diretamente sobre o faturamento.

---

## 🛠️ Como Subir para o GitHub Pages

1. Crie um repositório público no GitHub (ex: `acgo-energia-solar`).
2. Faça o upload de **todos** os arquivos deste pacote para a raiz do repositório (incluindo a pasta `img/` com a logo e a pasta `js/`).
3. Vá nas **Settings** (Configurações) do repositório no GitHub.
4. No menu lateral, clique em **Pages**.
5. Em **Build and deployment**, selecione **Deploy from a branch**, escolha a branch `main` (ou `master`) e a pasta `/ (root)`.
6. Clique em **Save**. O link público do seu sistema estará pronto em instantes!
