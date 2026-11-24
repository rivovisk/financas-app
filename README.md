# Finanças

O seu dinheiro num lugar só. O app lê os seus bancos pelo [Meu Pluggy](https://meu.pluggy.ai/), separa os gastos
sozinho e mostra para onde o dinheiro vai e quanto você tem.

- **Só lê.** Nunca move dinheiro.
- **Fica no seu computador.** Dados e chaves não vão para nenhuma nuvem, nem para quem fez o app.
- **Grátis.** Cada pessoa usa a própria conta do Meu Pluggy, com até 5 bancos, só para uso pessoal.

Funciona no Windows e no macOS. É uma versão de teste, feita para amigos.

## Instalar no Windows

1. [Baixe o app](https://github.com/rivovisk/financas-app/archive/refs/heads/main.zip).
2. Clique com o botão direito no ZIP e escolha **Extrair tudo**.
3. Abra a pasta e clique duas vezes em **Instalar.cmd**.
4. Se o Windows avisar que protegeu o computador, clique em **Mais informações** e em **Executar assim mesmo**. O aviso
   aparece porque o app não tem um certificado pago.

O instalador baixa o [Node](https://nodejs.org/pt) oficial (41 MB) para a pasta do Finanças e verifica a integridade. Se já tiver uma cópia verificada na pasta do app, ele a reaproveita. Não precisa de senha de administrador. O script `node.ps1` verifica o ZIP e o executável antes de usar o Node.

O app abre no navegador para você criar sua senha. Depois, use o atalho **Financas** na área de trabalho. Ele liga junto com o Windows.

## Primeiro uso no Mac

1. Instale a versão LTS do [Node.js](https://nodejs.org/pt/download) se você ainda não tiver Node 20 ou mais recente.
2. [Baixe o app](https://github.com/rivovisk/financas-app/archive/refs/heads/main.zip), extraia o ZIP e mova a pasta extraída para onde quer guardar o app.
3. Abra o Terminal, digite `cd ` (com um espaço no fim), arraste a pasta extraída para a janela do Terminal e pressione Enter.
4. Digite `node app/open.mjs` e pressione Enter. O app inicia no seu Mac e abre no navegador padrão para você criar sua senha.

Depois de reiniciar o Mac, repita os passos 3 e 4. Guarde a pasta extraída, pois é dela que o app roda e recebe as atualizações.

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

Na primeira abertura depois de atualizar para a versão com login, abra o app pelo atalho do Windows ou pelo comando do Mac para criar sua senha.

Quando há uma versão nova, o app avisa. Você clica em **Atualizar** e ele volta sozinho. Nada muda sem o seu clique.
Os dados e as chaves ficam fora da pasta do app. Se a versão nova não abrir, o app volta para a anterior.

Cada versão é assinada. O app só aceita arquivos com essa assinatura.

## Onde ficam os seus dados

Na pasta `.financas-pessoais`, dentro da sua pasta de usuário. No Mac, abra o Finder, pressione **Command + Shift + G** e digite `~/.financas-pessoais`. O app descarta os campos de CPF, endereço e renda do banco e filtra documentos nas descrições. O app
fala só com o Pluggy, e com o GitHub para ver se há versão nova. Nada seu é enviado para o GitHub.

## Remover

No Windows, clique duas vezes em **Desinstalar.cmd**. No Mac, reinicie o computador e mande a pasta extraída para o Lixo. Os seus dados ficam, caso você volte. Para apagar tudo, apague a pasta
`.financas-pessoais`. Para cortar o acesso, remova a conexão no Meu Pluggy.

## Achou um erro?

Conte para quem indicou o app. Antes de mandar uma foto da tela, use **Esconder valores** e cubra os nomes.
