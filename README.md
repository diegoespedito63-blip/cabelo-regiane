# Regiane Paulino: site, agendamento online e painel

Site da cabeleireira e consultora Mary Kay Regiane Paulino, com **agendamento online em tempo real** e um painel de gestão para o celular.
Feito com HTML, CSS e JavaScript puro, sem build. O banco de dados é o **Supabase** (plano gratuito).

## Arquivos (tudo numa pasta só, imagens incluídas)

```
index.html · style.css · script.js     → site público
agendar.js                             → fluxo de agendamento online
admin.html · admin.css · admin.js      → painel da Regiane
agenda-core.js                         → regras de disponibilidade (site + painel)
api.js                                 → conexão com o banco (Supabase ou modo demonstração)
config.js                              → WhatsApp, Instagram, Supabase, textos e galeria
supabase_schema.sql                    → criação do banco, segurança e funções
*.jpg / *.webp                         → fotos
```

## Como o agendamento funciona

1. A cliente escolhe **serviço → dia → horário → dados** no site.
2. O calendário só mostra dias e horários livres. A conta considera a duração do serviço, o horário de atendimento, a pausa, as folgas, a antecedência mínima e os horários já reservados.
3. O banco **confere tudo de novo** na hora de gravar e trava o dia, então duas pessoas não conseguem reservar o mesmo horário.
4. A cliente recebe um **código**, botões para salvar no Google Agenda ou no calendário do celular e, opcionalmente, um botão para avisar pelo WhatsApp.
5. No painel, o pedido aparece em **"Aguardando sua confirmação"**. A Regiane confirma ou recusa, e a mensagem para a cliente vai pronta pelo WhatsApp. Também dá para ligar a confirmação automática.
6. Pelo site, a cliente pode **consultar ou cancelar** usando o código e o WhatsApp, respeitando o prazo mínimo de cancelamento.
7. Quem agenda pelo site entra automaticamente em **Clientes**.

### No painel → Ajustes
- **Horário de atendimento** de cada dia, com pausa
- **Folgas e bloqueios**: dias inteiros ou faixas de horário (férias, feriados, compromissos)
- **Regras**: intervalo entre horários, antecedência mínima, quantos dias a agenda fica aberta, prazo para cancelar, confirmação automática e exibir preços
- **Serviços**: duração, preço e se aparece no site (os valores iniciais são **exemplos**)

## Modo demonstração x online

Com `supabase.url` vazio em `config.js`, tudo funciona no **modo demonstração**: os dados ficam só no navegador. Serve para testar o site e o painel no mesmo computador.

Para colocar no ar de verdade:

1. Crie um projeto gratuito em https://supabase.com.
2. Abra **SQL Editor**, cole o conteúdo de `supabase_schema.sql`, troque o e-mail na última linha pelo e-mail da Regiane e clique em **Run**.
3. Em **Authentication → Users → Add user**, crie o usuário com esse mesmo e-mail e uma senha.
4. Em **Authentication → Sign In / Providers**, desative **"Allow new users to sign up"**.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable** para `config.js`:
   ```js
   supabase: { url: "https://xxxx.supabase.co", anonKey: "sb_publishable_..." }
   ```
   Nunca use a chave `service_role`.
6. Publique a pasta (GitHub Pages, Netlify etc.). O painel fica em `/admin.html` e pede e-mail e senha.

**Segurança:** o público não lê nenhuma tabela. O site só usa quatro funções do banco (ver horários livres, agendar, consultar e cancelar), e nenhuma delas expõe nomes ou telefones de outras clientes. O painel só abre para e-mails cadastrados na tabela `administradores`.

## Pendências em `config.js`
- `whatsapp`: número com DDI e DDD, só dígitos (ex.: `5511999998888`)
- `instagram`: link do perfil
- `supabase`: dados do projeto (passo 5 acima)
