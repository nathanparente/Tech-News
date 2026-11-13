# Uso da Hacker News API

## Visão geral

A aplicação utiliza a API oficial do Hacker News para consultar:

- Notícias Recentes: `newstories`
- Melhores Notícias: `beststories`

Documentação: https://github.com/HackerNews/API
Base da API: https://hacker-news.firebaseio.com/v0/

## 1. Ausência de credenciais — Zero-Auth

Os endpoints públicos utilizados não exigem cadastro, token ou chave de API.

Isso elimina a necessidade de armazenar credenciais para essa integração,
mas não elimina a necessidade de validar respostas e controlar requisições.

A aplicação não deve interpretar acesso público como garantia de
disponibilidade ou permissão irrestrita de reutilização de conteúdo.
Os direitos das matérias externas continuam pertencendo aos respectivos autores.

## 2. Infraestrutura e transporte seguro — Firebase / HTTPS

A API oficial utiliza infraestrutura Firebase e é acessada por HTTPS.

O HTTPS protege a comunicação em trânsito. Entretanto, não garante
que o conteúdo enviado por usuários ou os sites externos vinculados sejam seguros.

A aplicação consulta somente endpoints conhecidos da API e não baixa
automaticamente páginas externas.

## 3. Tratamento de dados e sanitização — XSS

Títulos, textos, links e respostas do modelo são considerados dados não confiáveis.

Medidas adotadas:

- Validação das respostas no backend.
- Conversão do HTML das publicações para texto simples.
- Renderização textual pelo React, sem `dangerouslySetInnerHTML`.
- Aceitação somente de URLs HTTP e HTTPS.
- Links externos com `noopener noreferrer`.
- Validação estrutural da resposta do Ollama.

O conteúdo das notícias também pode conter prompt injection.
Por isso, o modelo não recebe ferramentas, acesso a arquivos ou permissão
para executar ações. Sua resposta é tratada apenas como texto.

## 4. Controle de tráfego e disponibilidade local

A aplicação usa cache temporário, limite de quantidade de notícias,
controle de concorrência e timeouts.

O backend e o Ollama devem permanecer restritos ao endereço de loopback.
O backend aceita somente a origem local configurada para o frontend.

A interface funciona localmente, mas a atualização das notícias depende
de conexão com a internet e da disponibilidade da API.

O processamento com llama3.1 depende do Ollama em execução e dos recursos
da máquina. Falhas são exibidas ao usuário, sem prometer operação offline.

## Limitação editorial

A API nem sempre disponibiliza o corpo da publicação.

O modelo resume exclusivamente o texto recebido. Quando existem apenas
título e link, traduz o título e sinaliza a ausência de conteúdo suficiente.

A data exibida vem do timestamp da publicação no Hacker News.
Ela não representa necessariamente a data original da matéria externa.