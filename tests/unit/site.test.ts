import { describe, expect, it } from 'vitest';
import { SELO_PERMANENCIA, SITE_URL } from '@/lib/site';

describe('constantes do site', () => {
  it('resolve uma URL absoluta valida', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(SITE_URL.endsWith('/')).toBe(false);
  });

  /**
   * O brand board, secao 09: "Nunca reescrever o texto."
   * Este teste existe para que qualquer alteracao no selo seja deliberada —
   * ele aparece na interface, no rodape do PDF e em material impresso, e as
   * tres ocorrencias precisam sair desta mesma constante.
   */
  it('mantem o selo de permanencia literal', () => {
    expect(SELO_PERMANENCIA).toBe('Estático · não expira · não depende deste site');
  });
});
