# Uso da GNews API

## Visão geral

A aplicação consulta a GNews pelo backend local.

- Últimas de tecnologia: `/search`, com busca temática e ordenação por data.
- Destaques de tecnologia: `/top-headlines`, categoria `technology`.

Base: https://gnews.io/api/v4
Documentação: https://docs.gnews.io/

A busca temática e as manchetes utilizam critérios diferentes.
Destaques não representam um ranking de melhores notícias.

## Autenticação

A GNews exige uma chave de API obtida após cadastro.

A chave fica em `GNEWS_API_KEY`, no ambiente do backend.
Ela não é enviada ao React nem incluída no repositório.

URLs autenticadas, corpos de erro e credenciais não devem aparecer nos logs.

## Transporte e certificados

A comunicação com a GNews utiliza HTTPS.

Em ambientes corporativos com inspeção HTTPS, o Node deve confiar na
CA corporativa aprovada. Quando suportado, usamos os certificados
do sistema com `NODE_USE_SYSTEM_CA=1`.

A validação TLS não deve ser desabilitada.

## Validação e XSS

Todos os dados externos são considerados não confiáveis.

A aplicação:

- Valida a estrutura dos dados recebidos.
- Converte HTML para texto simples.
- Renderiza conteúdo como texto no React.
- Não utiliza `dangerouslySetInnerHTML`.
- Aceita somente URLs HTTP e HTTPS sem credenciais embutidas.
- Valida a estrutura JSON retornada pelo Ollama.

O modelo não recebe ferramentas, acesso a arquivos ou permissão
para executar ações.

## Imagens externas

Quando disponível, a imagem retornada pela GNews é exibida no navegador.

Se estiver ausente ou falhar, permanece um placeholder.
O backend não baixa imagens nem matérias externas.

O carregamento de imagens permite que o servidor de origem receba
o IP do usuário. A política `no-referrer` evita enviar o referenciador.

## Tráfego e disponibilidade

São utilizados:

- Limite de 10 notícias por seleção.
- Cache de consultas por cinco minutos.
- Cache de resumos por trinta minutos.
- Uma geração em andamento por vez.
- Timeouts e limite local de requisições.

O cache é temporário e desaparece ao reiniciar o backend.

A cota, o atraso das notícias e os recursos disponíveis dependem
do plano contratado. O limite local não substitui a cota da GNews.

Backend e Ollama devem permanecer restritos ao loopback.

## Resumos e limitações editoriais

O llama3.1 processa somente o título, a descrição e o conteúdo
disponibilizados pela GNews.

Esses campos podem estar incompletos ou truncados.
O modelo não acessa automaticamente a matéria original.

Quando não houver informação suficiente, campos do resumo podem
ser nulos. O texto gerado por IA deve ser conferido na fonte.

A data exibida corresponde a `publishedAt`, informado pela GNews,
e não é gerada pelo modelo.

## Termos e direitos

A contratação ou gratuidade da API não elimina os direitos
dos veículos, autores e responsáveis pelas imagens.

Verifique os termos vigentes da GNews e as permissões aplicáveis
à exibição, ao processamento por IA e ao uso pretendido.