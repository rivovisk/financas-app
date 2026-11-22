# Finanças

O seu dinheiro num lugar só. O app lê os seus bancos pelo [Meu Pluggy](https://meu.pluggy.ai/), separa os gastos
sozinho e mostra para onde o dinheiro vai e quanto você tem.

- **Só lê.** Nunca move dinheiro.
- **Fica no seu computador.** Dados e chaves não vão para nenhuma nuvem, nem para quem fez o app.
- **Grátis.** Cada pessoa usa a própria conta do Meu Pluggy, com até 5 bancos, só para uso pessoal.

Funciona no Windows. É uma versão de teste, feita para amigos.

## Instalar

1. [Baixe o app](https://github.com/rivovisk/financas-app/archive/refs/heads/main.zip).
2. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
3. Abra a pasta e clique duas vezes em **Instalar.cmd**.
4. Se o Windows avisar que protegeu o computador, clique em **Mais informações** e em **Executar assim mesmo**. O aviso
   aparece porque o app não tem um certificado pago.

O app precisa do [Node](https://nodejs.org/pt), um programa grátis. Se o computador não tem, o instalador baixa o original
(41 MB), confere e guarda na pasta do app. Quem faz isso é o arquivo `node.ps1`. Não precisa de senha de administrador.

O app abre no navegador. Depois, use o atalho **Financas** na área de trabalho. Ele liga junto com o Windows.

## Ligar o seu banco

Leva uns 10 minutos, uma vez só. A tela do app mostra os mesmos passos.

1. Crie sua conta no [Meu Pluggy](https://meu.pluggy.ai/) e conecte o seu banco lá. Vá até o fim da tela do banco.
2. Entre no [Dashboard do Pluggy](https://dashboard.pluggy.ai/) com o **mesmo e-mail** e crie uma aplicação. Ignore o
   aviso de teste de 15 dias: ele não vale para uso pessoal.
3. Na aplicação, copie o **Client ID** e o **Client Secret**.
4. Abra a aplicação em **Demo**, clique em **Connect Account** e escolha **MeuPluggy**. Não escolha o seu banco.
5. Na mesma página, clique na conexão e copie o **Item ID**.
6. Cole os três no app e clique em **Conectar**.

Cada banco tem um Item ID. Para mais de um, separe por vírgula. A autorização vale por um ano, e o app avisa antes.

**Nunca mande essas chaves para ninguém.** Elas leem o seu extrato.

## Atualizações

Quando há uma versão nova, o app avisa. Você clica em **Atualizar** e ele volta sozinho. Nada muda sem o seu clique.
Os dados e as chaves ficam fora da pasta do app. Se a versão nova não abrir, o app volta para a anterior.

Cada versão é assinada. O app só aceita arquivos com essa assinatura.

## Onde ficam os seus dados

Na pasta `.financas-pessoais`, dentro da sua pasta de usuário do Windows. CPF, endereço e renda não são guardados. O app
fala só com o Pluggy, e com o GitHub para ver se há versão nova. Nada seu é enviado para o GitHub.

## Remover

Clique duas vezes em **Desinstalar.cmd**. Os seus dados ficam, caso você volte. Para apagar tudo, apague a pasta
`.financas-pessoais`. Para cortar o acesso, remova a conexão no Meu Pluggy.

## Achou um erro?

Conte para quem indicou o app. Antes de mandar uma foto da tela, use **Esconder valores** e cubra os nomes.
