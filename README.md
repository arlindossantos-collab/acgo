# ACGO Energia Solar — Portal de Gestão

Aplicação web estática para gestão de clientes, endereços e leituras/faturas de energia solar, com Firebase Authentication e Cloud Firestore.

## Funcionalidades

- Login por e-mail e senha.
- Perfil **Administrador**: visão geral, cadastro de usuários, gestão de endereços e lançamento de leituras.
- Perfil **Usuário comum**: consulta somente dos próprios indicadores, gráficos e histórico.
- Cadastro de usuário no painel administrativo sincronizado com Firebase Authentication e Firestore.
- Criação de contas por meio de uma instância secundária do Firebase Authentication: o administrador permanece autenticado durante o cadastro.
- Leituras vinculadas ao UID do usuário (`ownerUid`), não apenas ao e-mail.
- Regras de segurança Firestore incluídas em `firestore.rules`.

## Estrutura

```text
/
├── index.html
├── dashboard-admin.html
├── dashboard-client.html
├── firestore.rules
├── assets/
│   └── acgo-logo.png
└── js/
    ├── firebase-config.js
    ├── login.js
    ├── admin.js
    └── client.js
```

## Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Em **Firestore Database**, crie o banco de dados.
4. Em **Configurações do projeto → Seus apps**, registre um app Web.
5. Copie as credenciais do app para `js/firebase-config.js`.
6. Publique as regras de `firestore.rules` na seção **Firestore Database → Regras**.
7. Em Authentication, crie manualmente o primeiro administrador com e-mail e senha.
8. No Firestore, crie a coleção `users` e um documento cujo ID seja exatamente o **UID** do administrador criado no Authentication. Campos:
   - `uid`: UID do administrador (string)
   - `email`: e-mail (string)
   - `role`: `admin` (string)
   - `active`: `true` (boolean)
   - `addresses`: `[]` (array)

**Importante:** o primeiro administrador é inicializado manualmente para evitar que qualquer visitante possa se promover a administrador. Depois desse passo, administradores podem cadastrar novos usuários pelo próprio sistema.

## Cadastro de usuários

No painel administrador, abra **Usuários & Endereços → Novo Usuário**. Informe e-mail, senha inicial, perfil e endereços. A conta será criada no Authentication e o perfil correspondente será salvo em `users/{uid}` no Firestore. O Firebase exige senha com pelo menos 6 caracteres.

A criação do usuário usa uma segunda instância do Firebase no navegador, preservando a sessão do administrador. A chave de API web do Firebase não é uma senha secreta; a proteção efetiva dos dados depende das regras de segurança publicadas e da configuração correta do projeto.

## Publicação no GitHub Pages

1. Envie os arquivos deste projeto para um repositório GitHub.
2. Em **Settings → Pages**, escolha a branch principal e a pasta `/ (root)`.
3. Aguarde a publicação e cadastre o domínio publicado em **Authentication → Settings → Authorized domains** no Firebase.
4. Abra a URL do GitHub Pages e entre com o administrador inicial.

A aplicação deve ser servida por HTTP/HTTPS (GitHub Pages ou servidor local), não abrindo os HTMLs diretamente como `file://`.

## Modelo de dados

### `users/{uid}`

```json
{
  "uid": "firebase-auth-uid",
  "email": "cliente@exemplo.com",
  "role": "client",
  "active": true,
  "addresses": ["Rua Exemplo, 100"],
  "createdAt": "Firestore Timestamp"
}
```

Os papéis aceitos são `admin` e `client`. O campo `active` permite bloquear o acesso no portal. A desativação feita pela interface bloqueia o login na aplicação, mas não desabilita a conta no serviço Authentication.

### `readings/{readingId}`

```json
{
  "ownerUid": "firebase-auth-uid",
  "userEmail": "cliente@exemplo.com",
  "address": "Rua Exemplo, 100",
  "period": "Outubro/2026",
  "initialReading": 100,
  "finalReading": 250,
  "kwh": 150,
  "neoFee": 10,
  "fioB": 5
}
```

## Dados antigos / migração

A versão anterior gravava perfis com ID baseado no e-mail e leituras sem `ownerUid`. Esta versão utiliza UID do Firebase Authentication como chave e escopo de autorização. Antes de liberar os usuários, migre os documentos antigos:
- Recrie/associe cada perfil com ID igual ao UID real no Authentication.
- Adicione `ownerUid` às leituras antigas, com o UID correto do titular.
- Não libere regras permissivas para contornar a migração.

A aplicação nova não faz essa associação automaticamente porque não é seguro deduzir a identidade Firebase de um e-mail/documento legado sem validação.

## Observações de segurança

- Usuários comuns só conseguem ler o próprio documento e leituras com seu `ownerUid`.
- Apenas administradores podem criar/alterar perfis e leituras.
- O navegador não contém Firebase Admin SDK nem credenciais de serviço.
- Para desabilitar ou excluir contas no Authentication, use uma Cloud Function/Admin SDK em backend confiável; remover somente o documento Firestore não remove a conta do Authentication.
- Revise as regras no emulador/testes antes de uso em produção.

## Parâmetros de cálculo atuais

A aplicação mantém os parâmetros originais do projeto: tarifa solar de R$ 0,75/kWh e referência comparativa de R$ 1,10/kWh. Confirme se esses valores continuam adequados antes de utilizar os resultados como faturamento oficial.
