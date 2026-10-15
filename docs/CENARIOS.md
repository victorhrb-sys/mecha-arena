# Ambientes das fases

Três cenários criados com a ferramenta integrada de geração de imagens, uma geração por ambiente, sem variantes. Os originais finais foram copiados para o projeto em PNG, 1536 × 1024. Foram conferidos como imagens; não foi realizada inspeção visual do navegador nesta revisão.

| Ambiente | Arquivo final | Uso |
| --- | --- | --- |
| Loja de peças | `dist/assets/phase-shop.png` | Prateleiras de componentes e balcão, luz âmbar. |
| Oficina de montagem | `dist/assets/phase-workshop.png` | Bancada, ferramentas e pórtico de manutenção, luz azul. Também usado na preparação. |
| Arena | `dist/assets/phase-arena.png` | Piso circular de combate, arquibancadas e refletores com luz vermelha. Mantido durante resultado e repetição. |

Títulos, cores de ambiente e imagens reforçam a fase atual. A imagem não muda regras, métricas, dimensões do tabuleiro ou posição dos controles. As cores dos equipamentos e dos jogadores foram preservadas. A folha `dist/phase-scenes.css` concentra a apresentação dos ambientes.

## Prompts exatos

Cada prompt usou o prefixo abaixo, uma quebra de linha e o trecho específico do ambiente.

```text
Use case: stylized-concept
Asset type: final raster scene background for a dark industrial robot board-game interface; this image is solely environmental artwork, not a screenshot or UI design.
Style/medium: polished stylized 3D game concept art with restrained chunky hard-surface industrial science-fiction architecture, broad simple shapes, strong silhouettes, subtle brushed metal and low visual noise.
Composition/framing: wide landscape 1536x1024. Big quiet central and lower-central area to support overlaid game UI; concentrate recognizable scene details around the upper portion, right side, and periphery. Establish a coherent interior with cinematic perspective. Environment must stay recognizable under a dark translucent overlay; keep medium-value lit edges and legible peripheral silhouettes.
Color palette/materials: dark charcoal industrial metal, rich but restrained practical light, subtle material variation.
Constraints: render one single cohesive environment image. No text, no lettering, no labels, no logos, no watermark, no UI, no borders, no cards, no people, no robots in action. No excessive clutter, small greebles, sparks or floating effects.
```

### Loja

```text
Primary request: a recognizable robot spare-parts shop interior.
Scene/backdrop: organized shelving with sturdy robot metal parts, servos, armor segments and closed component crates along the back and side walls; a broad sales counter toward the right. Quiet open central floor and clearly readable large shelving forms around the upper periphery.
Lighting/mood: warm amber and gold practical lighting under shelves and over the sales counter, welcoming but dark industrial atmosphere.
```

### Oficina

```text
Primary request: a clearly recognizable robot assembly workshop interior, visually distinct from a retail shop.
Scene/backdrop: a broad heavy workbench along the right, neatly arranged wall-mounted large tools, a suspended overhead gantry, and an empty maintenance bay. Wide uncluttered central floor and reserved work-zone details around the edges.
Lighting/mood: cool blue and cyan task lights illuminate the workbench, overhead gantry and maintenance bay. Technical, calm industrial mood.
```

### Arena

```text
Primary request: an empty combat stadium interior, visually distinct from a shop or workshop.
Scene/backdrop: a large circular steel fighting floor occupies the calm central and lower space; distant sweeping spectator tiers around the upper background with no people detail; bold overhead stadium floodlights. Large simple concentric floor panels with minimal markings and no symbols.
Lighting/mood: dramatic overhead floodlights, red and orange edge lights tracing the dark steel stadium perimeter, controlled contrast, dramatic but not busy.
```
