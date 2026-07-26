type UrlValidationResult = {
  isValid: boolean;
  message: string;
};

export function normalizeUrl(value: string) {
  return value.trim();
}

export function validateUrl(value: string): UrlValidationResult {
  if (!value) {
    return {
      isValid: false,
      message: 'Informe uma URL antes de gerar o QR Code.',
    };
  }

  try {
    const parsedUrl = new URL(value);
    const supportedProtocols = ['http:', 'https:'];

    if (!supportedProtocols.includes(parsedUrl.protocol)) {
      return {
        isValid: false,
        message: 'Use uma URL iniciando com http:// ou https://.',
      };
    }

    return {
      isValid: true,
      message: '',
    };
  } catch {
    return {
      isValid: false,
      message: 'A URL informada é inválida. Revise o texto e tente novamente.',
    };
  }
}
