# Segurança

O Baixou não pede cadastro e não guarda dados pessoais. As chaves (Mercado Livre, Telegram, Cloudflare) ficam
**somente** em *Settings → Secrets and variables → Actions* do GitHub, nunca no código.

Se encontrar uma falha, abra um aviso privado em *Security → Report a vulnerability* neste repositório
(ou fale com o dono do projeto). Por favor, não publique detalhes antes de a falha ser corrigida.

O que o projeto já faz:
- O robô só publica ofertas que passam pelo guardião: link no domínio do Mercado Livre (sem disfarces), com código de afiliado.
- O site tem política de segurança de conteúdo (CSP) que bloqueia scripts que não sejam os do próprio site.
- O workflow roda com permissões mínimas e com as ações do GitHub fixadas por versão exata.
- Fotos só do Mercado Livre (https://*.mlstatic.com): nenhuma imagem de terceiros pode virar "rastreador" de IP,
  nem no site, nem nas páginas de compartilhamento, nem no canal do Telegram.
- Fontes hospedadas no próprio site; as páginas de compartilhamento também têm CSP.
- O contador limita envios por visitante (429 acima de 30 por minuto) e não grava IP.
- Testes automáticos que reprovam o robô se houver chave colada no código, se a CSP ficar desatualizada
  ou se aparecer um handler inline. Antes de publicar, o site também é atacado com URLs e dados envenenados.
