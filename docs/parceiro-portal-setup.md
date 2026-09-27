# Portal do Parceiro — configuração (passo a passo)

Faça isso uma vez. Leva uns 15 minutos.

## 1. Criar as tabelas novas no banco

1. Entre em https://supabase.com/dashboard e abra o projeto do Floripa.My.
2. No menu da esquerda, clique em **SQL Editor**.
3. Clique em **+ New query**.
4. Abra o arquivo `supabase/migrations/0005_checkin_cortesia.sql` do projeto, copie **todo** o conteúdo e cole no editor.
5. Clique em **Run** (canto inferior direito). Deve aparecer "Success. No rows returned".

## 2. Copiar a chave pública (anon)

1. No menu da esquerda, clique em **Project Settings** (engrenagem) → **API Keys**.
2. Copie a chave **anon public**.
3. No computador, abra o arquivo `.env.local` do projeto e adicione a linha: `SUPABASE_ANON_KEY=` seguida da chave copiada.
4. Se quiser o link de WhatsApp na tela de login, adicione também `WHATSAPP_CONTATO=5548XXXXXXXXX` (só números, com 55 e o DDD).
5. No Vercel (https://vercel.com → projeto **floripa-me-demo** → **Settings** → **Environment Variables**), crie as mesmas variáveis (`SUPABASE_ANON_KEY` e, se usar, `WHATSAPP_CONTATO`) e clique em **Save**.

## 3. Ligar o login por e-mail

1. No Supabase, menu da esquerda: **Authentication** → **Sign In / Providers**.
2. Confirme que **Email** está ligado (Enabled).

## 4. Dizer ao Supabase para onde o link pode levar

1. **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o endereço do site no Vercel (ex.: `https://floripa-me-demo.vercel.app`).
3. Em **Redirect URLs**, clique em **Add URL** e adicione, uma de cada vez:
   - `http://localhost:3000/parceiro/auth/callback**`
   - `https://floripa-me-demo.vercel.app/parceiro/auth/callback**` (troque pelo seu endereço real, se for outro)
4. Clique em **Save**.

## 5. Ajustar o e-mail do link mágico

1. **Authentication** → **Emails** → aba **Templates** → **Magic Link**.
2. Troque o assunto para: `Seu acesso ao Portal do Parceiro Floripa.My`
3. Apague o corpo e cole:

   ```html
   <h2>Portal do Parceiro Floripa.My</h2>
   <p>Toque no botão abaixo para entrar. O link vale por 1 hora e só pode ser usado uma vez.</p>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Entrar no Portal do Parceiro</a></p>
   ```

4. Clique em **Save changes**.
5. Ainda em **Templates**, abra **Confirm signup** (é o e-mail que o parceiro recebe **na primeira vez** que entra) e faça o mesmo: assunto `Seu acesso ao Portal do Parceiro Floripa.My` e o mesmo corpo acima. Clique em **Save changes**.

> O link só funciona nos endereços da lista do passo 4. Endereços de "preview" do Vercel (os que mudam a cada push) não estão nela — teste o login sempre no endereço principal.

## 6. Cadastrar o parceiro

No painel `/admin`, abra o estabelecimento e confira:
- **É parceiro** marcado e **verificado**;
- **E-mail de contato** preenchido com o e-mail que o dono vai usar para entrar;
- **Oferta** preenchida, se ele tiver cortesia.

## 7. Antes de ter muitos parceiros: e-mail próprio (Resend)

O envio de e-mail padrão do Supabase só manda poucos e-mails por hora. Quando for lançar para valer, configure um provedor (ex.: Resend, gratuito até um bom volume) em **Authentication** → **Emails** → **SMTP Settings**. Peça ajuda nesse passo.

## 8. O QR do display de balcão

O QR do verso do display deve apontar para: `https://<seu-endereço>/parceiro/validar`
