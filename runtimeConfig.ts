const LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';

const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

export const resolveApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return normalizeUrl(configuredBaseUrl);
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      return LOCAL_API_BASE_URL;
    }
  }

  return '';
};

export const getMissingApiBaseUrlMessage = (): string =>
  '前端未配置 VITE_API_BASE_URL。请在 Zeabur 前端服务中设置它为后端公网域名，例如 https://your-backend.zeabur.app，然后重新部署前端。';
